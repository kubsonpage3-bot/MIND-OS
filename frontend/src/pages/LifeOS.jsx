import NutritionTab from '@/components/mindos/NutritionTab';

export default function LifeOS() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--habit-bg)' }}>
      <div className="max-w-2xl mx-auto px-0 md:px-4 py-4">
        <NutritionTab />
      </div>
    </div>
  );
}