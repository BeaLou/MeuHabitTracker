import { activeChallenge, challengeDayNumber, doneCount, CHALLENGE_DAYS } from '../core/challenge';
import { todayKey } from '../core/dates';
import type { Habit } from '../core/types';

export function ChallengeCard({ habits, onOpen }: { habits: Habit[]; onOpen: () => void }) {
  const today = todayKey();
  const mine = activeChallenge(habits);
  const start = mine[0]?.startDate;
  const end = mine[0]?.targetDate;
  const done = doneCount(mine, today);

  let status = 'Começar ›';
  if (start && today < start) status = 'Ainda não começou ›';
  else if (start && end && today > end) status = 'Período encerrado ›';
  else if (start) status = `Dia ${challengeDayNumber(start, today)} de ${CHALLENGE_DAYS} · ${done}/${mine.length}`;
  const running = !!start && today >= start && !!end && today <= end;

  return (
    <button className="challenge-entry" onClick={onOpen}>
      <span className="top"><b>Desafio 75</b><span>{status}</span></span>
      {running && <span className="bar"><i style={{ width: `${(done / mine.length) * 100}%` }} /></span>}
    </button>
  );
}
