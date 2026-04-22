import argparse
import os
import random
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def list_images(folder: Path):
    exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts]


def augment(img: Image.Image, size: int, rng: random.Random) -> Image.Image:
    out = img.convert("RGB")

    if rng.random() < 0.5:
        out = ImageOps.mirror(out)

    angle = rng.uniform(-18, 18)
    out = out.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

    w, h = out.size
    crop_ratio = rng.uniform(0.8, 0.98)
    cw, ch = int(w * crop_ratio), int(h * crop_ratio)
    left = rng.randint(0, max(0, w - cw))
    top = rng.randint(0, max(0, h - ch))
    out = out.crop((left, top, left + cw, top + ch))

    brightness = ImageEnhance.Brightness(out)
    out = brightness.enhance(rng.uniform(0.75, 1.25))

    contrast = ImageEnhance.Contrast(out)
    out = contrast.enhance(rng.uniform(0.8, 1.3))

    color = ImageEnhance.Color(out)
    out = color.enhance(rng.uniform(0.8, 1.25))

    if rng.random() < 0.25:
        out = out.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.3, 1.2)))

    return out.resize((size, size), Image.Resampling.BICUBIC)


def build_pool(src_dir: Path, pool_dir: Path, pool_size: int, size: int, seed: int):
    rng = random.Random(seed)
    images = list_images(src_dir)
    if not images:
        raise FileNotFoundError(f"No source images found in {src_dir}")

    pool_dir.mkdir(parents=True, exist_ok=True)

    built = 0
    for img_path in images:
        with Image.open(img_path) as img:
            out = img.convert("RGB").resize((size, size), Image.Resampling.BICUBIC)
            out.save(pool_dir / f"pool_{built:05d}.jpg", quality=90)
            built += 1
            if built >= pool_size:
                return built

    while built < pool_size:
        src = rng.choice(images)
        with Image.open(src) as img:
            out = augment(img, size, rng)
            out.save(pool_dir / f"pool_{built:05d}.jpg", quality=88)
        built += 1

    return built


def generate_for_class(src_dir: Path, dst_dir: Path, target_count: int, size: int, seed: int):
    dst_dir.mkdir(parents=True, exist_ok=True)
    pool_dir = dst_dir.parent / f"_{dst_dir.name}_pool"
    pool_size = min(1200, max(300, target_count // 10))
    build_pool(src_dir, pool_dir, pool_size, size, seed)

    pool_files = list_images(pool_dir)
    if not pool_files:
        raise RuntimeError(f"No pool images generated for {dst_dir.name}")

    existing = len(list_images(dst_dir))
    for i in range(existing, target_count):
        src = pool_files[i % len(pool_files)]
        dst = dst_dir / f"img_{i:06d}.jpg"
        try:
            os.link(src, dst)
        except Exception:
            # Fallback for filesystems that do not support hard links.
            with Image.open(src) as img:
                img.save(dst, quality=90)

    return target_count


def main():
    parser = argparse.ArgumentParser(description="Generate large synthetic damaged/intact dataset")
    parser.add_argument("--source_dir", default="dataset", help="Source directory with damaged/ and intact/")
    parser.add_argument("--output_dir", default="dataset_large", help="Output directory for large dataset")
    parser.add_argument("--target_per_class", type=int, default=25000, help="Target image count per class")
    parser.add_argument("--size", type=int, default=224, help="Output image size")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)

    damaged_written = generate_for_class(
        source_dir / "damaged",
        output_dir / "damaged",
        args.target_per_class,
        args.size,
        args.seed,
    )
    intact_written = generate_for_class(
        source_dir / "intact",
        output_dir / "intact",
        args.target_per_class,
        args.size,
        args.seed + 101,
    )

    print("Large dataset generation complete")
    print(f"damaged: {damaged_written}")
    print(f"intact: {intact_written}")
    print(f"output_dir: {output_dir}")


if __name__ == "__main__":
    main()
