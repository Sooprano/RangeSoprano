import type { CalcMode } from '@/modules/calculators/calcMeta';
import type { CalcSeedNumbers } from '@/utils/spotCalc';
import { BluffEvCalc } from '@/modules/calculators/BluffEvCalc';
import { EvComplexCalc } from '@/modules/calculators/EvComplexCalc';
import { DoubleBarrelEvCalc } from '@/modules/calculators/DoubleBarrelEvCalc';
import { CallVsRaiseCalc } from '@/modules/calculators/CallVsRaiseCalc';
import { AllInEvCalc } from '@/modules/calculators/AllInEvCalc';
import { FoldEquityRequiredCalc } from '@/modules/calculators/FoldEquityRequiredCalc';
import { ImpliedOddsCalc } from '@/modules/calculators/ImpliedOddsCalc';
import { EvBasicCalc } from '@/modules/calculators/EvBasicCalc';
import { CheckVsBetCalc } from '@/modules/calculators/CheckVsBetCalc';
import { CheckCompoundEvCalc } from '@/modules/calculators/CheckCompoundEvCalc';

/**
 * Renders the calculator for a given mode, pre-filled from the decision seed.
 * Seeds are passed as numbers and stringified here via `fmt` (which the
 * worksheet wires to the € / BB unit). Calcs we haven't seeded yet render with
 * their own defaults — the user still lands on the right tool.
 */
export function InlineCalc({
  mode,
  seed,
  fmt,
}: {
  mode: CalcMode;
  seed: CalcSeedNumbers;
  fmt: (n: number | undefined) => string | undefined;
}) {
  switch (mode) {
    case 'bluff-ev':
      return <BluffEvCalc initialPot={fmt(seed.pot)} initialBet={fmt(seed.bet)} />;
    case 'double-barrel':
      return (
        <DoubleBarrelEvCalc
          initialPotTurn={fmt(seed.potTurn)}
          initialBetTurn={fmt(seed.betTurn)}
          initialBetRiver={fmt(seed.betRiver)}
        />
      );
    case 'call-vs-raise':
      return (
        <CallVsRaiseCalc
          initialPot={fmt(seed.pot)}
          initialCall={fmt(seed.call)}
          initialShove={fmt(seed.shove)}
        />
      );
    case 'all-in-ev':
      return (
        <AllInEvCalc
          initialPot={fmt(seed.pot)}
          initialCall={fmt(seed.call)}
          initialShove={fmt(seed.shove)}
        />
      );
    case 'ev-complex':
      return (
        <EvComplexCalc
          initialCurrentPot={fmt(seed.currentPot ?? seed.pot)}
          initialLoseAmount={fmt(seed.loseAmount ?? seed.bet)}
        />
      );
    case 'check-vs-bet':
      return (
        <CheckVsBetCalc initialPot={fmt(seed.pot)} initialBet={fmt(seed.bet)} />
      );
    case 'check-ev':
      return <CheckCompoundEvCalc initialPot={fmt(seed.pot)} />;
    case 'implied-odds':
      return (
        <ImpliedOddsCalc
          initialCurrentPot={fmt(seed.currentPot ?? seed.pot)}
          initialCall={fmt(seed.call)}
          initialRemainingStack={fmt(seed.effectiveStack)}
        />
      );
    case 'fold-equity-required':
      return <FoldEquityRequiredCalc />;
    case 'ev-basic':
      return <EvBasicCalc />;
    default:
      return null;
  }
}
