import { CATALOGUE_SNAPSHOT, openingHoursRows, useCatalogue } from "@/lib/catalogue";

// The salon's weekly hours, straight from WubSync — the same hours online
// booking enforces. Renders nothing if WubSync has none (never guessed).
const OpeningHours = ({ className = "" }: { className?: string }) => {
  const { catalogue } = useCatalogue();
  const rows = openingHoursRows(catalogue.openingHours ?? CATALOGUE_SNAPSHOT.openingHours);
  if (!rows.length) return null;
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm ${className}`} data-testid="opening-hours">
      {rows.map((row) => (
        <div key={row.day} className="contents">
          <dt className="text-muted-foreground">{row.day}</dt>
          <dd className="tabular-nums">{row.hours}</dd>
        </div>
      ))}
    </dl>
  );
};

export default OpeningHours;
