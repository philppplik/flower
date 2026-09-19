"""Optional local AI adapter. PNG on stdin, grayscale selection PNG on stdout."""
import io
import sys


def main():
    from PIL import Image
    from rembg import new_session, remove

    Image.MAX_IMAGE_PIXELS = 12_000_000
    raw = sys.stdin.buffer.read(12 * 1024 * 1024 + 1)
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError("Image exceeds 12 MB.")
    image = Image.open(io.BytesIO(raw))
    if image.format != "PNG" or image.width * image.height > 12_000_000:
        raise ValueError("Expected a PNG up to 12 megapixels.")
    image.load()
    session = new_session("u2net")
    result = remove(image.convert("RGB"), session=session, only_mask=True)
    result.convert("L").save(sys.stdout.buffer, format="PNG")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Local selection failed: {exc}", file=sys.stderr)
        sys.exit(1)
