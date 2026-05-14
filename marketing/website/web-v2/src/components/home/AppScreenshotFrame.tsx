import Image from "next/image";
import styles from "./AppScreenshotFrame.module.css";

type AppScreenshotFrameProps = {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  orientation?: "portrait" | "landscape";
};

export function AppScreenshotFrame({
  src,
  alt,
  label,
  className = "",
  orientation = "portrait",
}: AppScreenshotFrameProps) {
  return (
    <figure className={`${styles.frame} ${styles[orientation]} ${className}`}>
      <div className={styles.screenChrome}>
        <span />
        <span />
        <span />
      </div>
      <Image
        src={src}
        alt={alt}
        className={styles.image}
        fill
        sizes="(max-width: 760px) 78vw, 34rem"
      />
      {label ? <figcaption className={styles.caption}>{label}</figcaption> : null}
    </figure>
  );
}
