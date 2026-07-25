import {
  Activity,
  ScanLine,
  Scale,
  Droplet,
  Flame,
  Disc3,
  Snowflake,
  Boxes,
  type LucideProps,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  activity: Activity,
  'scan-line': ScanLine,
  scale: Scale,
  droplet: Droplet,
  flame: Flame,
  'disc-3': Disc3,
  snowflake: Snowflake,
};

export function CategoriaIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = MAP[name] ?? Boxes;
  return <Icon {...props} />;
}
