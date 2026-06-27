import RankBadge from "./RankBadge";

export default function RankDisplay({ rankXP = 0 }) {
  return <RankBadge rankXP={rankXP} />;
}