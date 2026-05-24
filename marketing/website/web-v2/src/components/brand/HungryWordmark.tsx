import Image from "next/image";

type HungryWordmarkProps = {
  className?: string;
};

const logoPath = "/images/Logo/hungry_logo_text_transparent.png";

export function HungryWordmark({ className = "" }: HungryWordmarkProps) {
  return (
    <Image
      alt="Hungry"
      className={`h-auto w-auto object-contain ${className}`}
      height={44}
      priority={false}
      src={logoPath}
      width={140}
    />
  );
}

