interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  containerClassName?: string;
}
export function PageHero({
  eyebrow,
  title,
  description,
  className = "",
  containerClassName = "",
}: PageHeroProps) {
  return (
    <section className={`relative flex flex-col justify-center bg-hero text-white min-h-[190px] sm:min-h-[210px] lg:min-h-[230px] ${className}`}>
      <div className={`container mx-auto w-full min-w-0 px-4 py-7 sm:py-8 lg:px-8 lg:py-9 text-center sm:text-left flex flex-col items-center sm:items-start ${containerClassName}`}>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--electric)]">{eyebrow}</p>}
        <h1 className="w-full max-w-3xl break-words text-balance text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
        {description && <p className="mt-3 w-full max-w-2xl break-words text-justify text-base leading-relaxed text-white/75 sm:text-left sm:text-lg">{description}</p>}
      </div>
    </section>
  );
}
