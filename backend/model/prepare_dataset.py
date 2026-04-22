import argparse
import hashlib
import random
from pathlib import Path
from shutil import copy2

from PIL import Image


def iter_images(folder: Path):
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    if not folder.exists():
        return []
    return [p for p in folder.rglob("*") if p.suffix.lower() in exts and p.is_file()]


def file_hash(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def is_valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


def split_items(items, train_ratio, val_ratio, seed):
    random.Random(seed).shuffle(items)
    n = len(items)
    train_end = int(n * train_ratio)
    val_end = train_end + int(n * val_ratio)
    return items[:train_end], items[train_end:val_end], items[val_end:]


def copy_split(paths, target_dir: Path, split_name: str, class_name: str):
    out_dir = target_dir / split_name / class_name
    out_dir.mkdir(parents=True, exist_ok=True)
    for src in paths:
        dest = out_dir / src.name
        copy2(src, dest)


def process_class(raw_dir: Path, class_name: str, max_count: int | None):
    source = raw_dir / class_name
    all_images = iter_images(source)
    unique = []
    seen = set()

    for path in all_images:
        if not is_valid_image(path):
            continue
        digest = file_hash(path)
        if digest in seen:
            continue
        seen.add(digest)
        unique.append(path)

    if max_count is not None:
        unique = unique[:max_count]

    return unique


def main():
    parser = argparse.ArgumentParser(description="Prepare large dataset splits from raw damaged/intact folders")
    parser.add_argument("--raw_dir", required=True, help="Path containing raw/damaged and raw/intact")
    parser.add_argument("--output_dir", required=True, help="Output dir for train/val/test split folders")
    parser.add_argument("--train_ratio", type=float, default=0.8)
    parser.add_argument("--val_ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max_per_class", type=int, default=None, help="Optional cap per class for quick experiments")
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    output_dir = Path(args.output_dir)

    if args.train_ratio + args.val_ratio >= 1.0:
        raise ValueError("train_ratio + val_ratio must be less than 1.0")

    classes = ["damaged", "intact"]
    summary = {}

    for class_name in classes:
        images = process_class(raw_dir, class_name, args.max_per_class)
        train, val, test = split_items(images, args.train_ratio, args.val_ratio, args.seed)

        copy_split(train, output_dir, "train", class_name)
        copy_split(val, output_dir, "val", class_name)
        copy_split(test, output_dir, "test", class_name)

        summary[class_name] = {
            "total": len(images),
            "train": len(train),
            "val": len(val),
            "test": len(test),
        }

    print("Dataset preparation complete:")
    for name, stats in summary.items():
        print(f"{name}: total={stats['total']} train={stats['train']} val={stats['val']} test={stats['test']}")
    print(f"Output written to: {output_dir}")


if __name__ == "__main__":
    main()
