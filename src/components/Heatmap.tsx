import { formatBR, type DateKey } from '../core/dates';
import { heatWeeks } from '../core/heatmap';

interface Props {
  today: DateKey;
  level: (key: DateKey) => number;
}

export function Heatmap({ today, level }: Props) {
  const weeks = heatWeeks(today, level);
  const active = weeks.flat().filter((d) => d.level).length;
  return (
    <div className="heatmap">
      <div className="grid" role="img" aria-label={`Constância das últimas ${weeks.length} semanas: ${active} dias com atividade`}>
        {weeks.flat().map((d) => (
          <i key={d.key} className={d.level === null ? 'future' : `l${d.level}`} title={formatBR(d.key)} />
        ))}
      </div>
      <div className="legend">
        <span>Últimas {weeks.length} semanas</span>
        <span className="scale">menos <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> mais</span>
      </div>
    </div>
  );
}
