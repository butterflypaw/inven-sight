import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf

AUTOTUNE = tf.data.AUTOTUNE


def build_datasets(data_dir, img_size, batch_size, seed):
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="training",
        seed=seed,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode="binary",
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="validation",
        seed=seed,
        image_size=(img_size, img_size),
        batch_size=batch_size,
        label_mode="binary",
    )

    class_names = train_ds.class_names

    train_ds = train_ds.cache().shuffle(1000, seed=seed).prefetch(AUTOTUNE)
    val_ds = val_ds.cache().prefetch(AUTOTUNE)

    return train_ds, val_ds, class_names


def compute_class_weights(train_ds):
    labels = np.concatenate([y.numpy().astype(np.int32).reshape(-1) for _, y in train_ds], axis=0)
    counts = np.bincount(labels, minlength=2)
    total = np.sum(counts)

    if np.any(counts == 0):
        return None

    class_weights = {
        0: float(total / (2.0 * counts[0])),
        1: float(total / (2.0 * counts[1])),
    }
    return class_weights


def build_model(img_size, dropout):
    inputs = tf.keras.Input(shape=(img_size, img_size, 3))

    augment = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomContrast(0.15),
            tf.keras.layers.RandomZoom(0.12),
            tf.keras.layers.RandomTranslation(0.06, 0.06),
            tf.keras.layers.RandomBrightness(0.12),
            tf.keras.layers.GaussianNoise(0.02),
        ],
        name="augmentation",
    )

    x = augment(inputs)
    x = tf.keras.layers.Rescaling(1.0 / 255.0)(x)

    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(img_size, img_size, 3),
    )
    base_model.trainable = False

    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(dropout)(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(dropout * 0.6)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid", dtype="float32")(x)

    model = tf.keras.Model(inputs, outputs, name="invensight_efficientnetb0")

    model.compile(
        optimizer=tf.keras.optimizers.AdamW(learning_rate=3e-4, weight_decay=1e-5),
        loss=tf.keras.losses.BinaryCrossentropy(label_smoothing=0.03),
        metrics=[
            tf.keras.metrics.BinaryAccuracy(name="accuracy"),
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )

    return model, base_model


def fine_tune_model(model, base_model, fine_tune_layers):
    base_model.trainable = True

    for layer in base_model.layers[:-fine_tune_layers]:
        layer.trainable = False

    for layer in base_model.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.AdamW(learning_rate=1e-5, weight_decay=1e-6),
        loss=tf.keras.losses.BinaryCrossentropy(),
        metrics=[
            tf.keras.metrics.BinaryAccuracy(name="accuracy"),
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )


def save_metadata(output_dir, class_names, history_head, history_ft):
    metadata = {
        "class_names": class_names,
        "head_training": history_head.history,
        "fine_tuning": history_ft.history,
    }

    metadata_path = output_dir / "training_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Train high-accuracy InvenSight model")
    parser.add_argument("--data_dir", default="dataset", help="Path to dataset root directory")
    parser.add_argument("--output_dir", default="model", help="Directory to save trained artifacts")
    parser.add_argument("--img_size", type=int, default=224, help="Input image size")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--epochs_head", type=int, default=14, help="Epochs for frozen backbone training")
    parser.add_argument("--epochs_finetune", type=int, default=24, help="Epochs for fine-tuning")
    parser.add_argument("--fine_tune_layers", type=int, default=60, help="Number of final backbone layers to unfreeze")
    parser.add_argument("--dropout", type=float, default=0.35, help="Dropout ratio before classifier head")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--steps_per_epoch", type=int, default=None, help="Optional cap for training steps per epoch")
    parser.add_argument("--validation_steps", type=int, default=None, help="Optional cap for validation steps per epoch")

    args = parser.parse_args()

    tf.keras.utils.set_random_seed(args.seed)

    if tf.config.list_physical_devices("GPU"):
        try:
            tf.keras.mixed_precision.set_global_policy("mixed_float16")
            print("Enabled mixed precision for GPU training.")
        except Exception as err:
            print("Mixed precision could not be enabled:", str(err))

    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not data_dir.exists():
        raise FileNotFoundError(
            f"Dataset not found at: {data_dir}. Expected folders like {data_dir / 'damaged'} and {data_dir / 'intact'}."
        )

    train_ds, val_ds, class_names = build_datasets(data_dir, args.img_size, args.batch_size, args.seed)
    class_weights = compute_class_weights(train_ds)

    model, base_model = build_model(args.img_size, args.dropout)

    checkpoint_path = output_dir / "model_best.keras"

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(checkpoint_path),
            monitor="val_auc",
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_auc",
            mode="max",
            patience=6,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_auc",
            mode="max",
            factor=0.4,
            patience=3,
            min_lr=1e-7,
            verbose=1,
        ),
    ]

    print("Starting phase 1 training...")
    history_head = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs_head,
        class_weight=class_weights,
        callbacks=callbacks,
        steps_per_epoch=args.steps_per_epoch,
        validation_steps=args.validation_steps,
        verbose=1,
    )

    print("Starting phase 2 fine-tuning...")
    fine_tune_model(model, base_model, args.fine_tune_layers)
    history_ft = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs_head + args.epochs_finetune,
        initial_epoch=len(history_head.history.get("loss", [])),
        class_weight=class_weights,
        callbacks=callbacks,
        steps_per_epoch=args.steps_per_epoch,
        validation_steps=args.validation_steps,
        verbose=1,
    )

    final_model_path = output_dir / "model_final.keras"
    model.save(final_model_path)

    final_h5_path = output_dir / "model_final.h5"
    h5_saved = False
    try:
        model.save(final_h5_path)
        h5_saved = True
    except Exception as err:
        # Some Python/Keras combinations fail during legacy HDF5 serialization.
        # Keep training successful by treating .keras as the primary output.
        print(f"Skipping legacy H5 export: {err}")

    loss, acc, auc, precision, recall = model.evaluate(val_ds, verbose=0)
    print("Validation metrics")
    print(f"loss: {loss:.4f}")
    print(f"accuracy: {acc:.4f}")
    print(f"auc: {auc:.4f}")
    print(f"precision: {precision:.4f}")
    print(f"recall: {recall:.4f}")

    save_metadata(output_dir, class_names, history_head, history_ft)

    print(f"Saved best checkpoint at: {checkpoint_path}")
    print(f"Saved final model at: {final_model_path}")
    if h5_saved:
        print(f"Saved h5 model at: {final_h5_path}")
    else:
        print("Saved h5 model at: skipped (legacy serialization unsupported in current environment)")
    print(f"Saved metadata at: {output_dir / 'training_metadata.json'}")


if __name__ == "__main__":
    main()
