import Image from "next/image";

type HungryWordmarkProps = {
  className?: string;
};

const logoPath = "/images/Logo/hungry_logo_text_transparent.png";
const HUNGRY_LOGO_WIDTH = 140;
const HUNGRY_LOGO_HEIGHT = 40;

export function HungryWordmark({ className = "" }: HungryWordmarkProps) {
  return (
    <Image
      alt="Hungry"
      className={`object-contain ${className}`}
      height={HUNGRY_LOGO_HEIGHT}
      loading="eager"
      priority={false}
      style={{ width: `${HUNGRY_LOGO_WIDTH}px`, height: `${HUNGRY_LOGO_HEIGHT}px` }}
      src={logoPath}
      width={HUNGRY_LOGO_WIDTH}
    />
  );
}
