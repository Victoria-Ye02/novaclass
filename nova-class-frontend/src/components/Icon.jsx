const CDN_SIZES = [32, 48, 64, 96, 128];

export default function Icon({ name, size = 20, alt = "", style }) {
  const cdnSize = CDN_SIZES.find(s => s >= size) ?? CDN_SIZES.at(-1);
  return (
    <img
      src={`https://img.icons8.com/fluency/${cdnSize}/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    />
  );
}
