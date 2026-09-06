import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import ClassSelector from "@/components/mindos/ClassSelector";
import ConfettiBurst from "@/components/mindos/ConfettiBurst";
import { playSound } from "@/lib/soundEffects";
import { Sparkles, UserCheck } from "lucide-react";

export default function SelectClass() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { refreshProfile } = useDjangoAuth();
  const isChanging = location.state?.changingClass;
  const [showConfetti, setShowConfetti] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["userprofile"],
    queryFn: () => djangoApi.profile.get(),
  });

  const [errorMsg, setErrorMsg] = useState(null);

  const completeOnboardingMutation = useMutation({
    mutationFn: async (selectedClassId) => {
      return djangoApi.profile.update({
        character_class: selectedClassId,
      });
    },
    onSuccess: async () => {
      setShowConfetti(true);
      playSound("level_up");
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (typeof refreshProfile === "function") {
        await refreshProfile();
      }
      setTimeout(() => {
        navigate("/");
      }, 1500);
    },
    onError: (err) => {
      setErrorMsg(err?.message || t("select_class.init_failed", "Initialization failed. Please try again."));
    },
  });

  const handleClassSelection = async (classId) => {
    setErrorMsg(null);
    await completeOnboardingMutation.mutateAsync(classId);
  };

  return (
    <div className="h-dvh w-full bg-[#05040a] text-foreground p-4 md:p-8 overflow-y-auto overflow-x-hidden selection:bg-purple-500/30 relative touch-pan-y">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-xl mx-auto relative z-10 pt-4 pb-28">
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            {isChanging ? t("select_class.class_recalibration", "CLASS RECALIBRATION") : t("select_class.select_architecture", "SELECT CLASS ARCHITECTURE")}
          </div>

          <h1 className="text-3xl md:text-4xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-purple-300">
            {t("select_class.choose_class_title", "CHOOSE YOUR CLASS")}
          </h1>

          <p className="text-xs font-mono text-purple-300/80 max-w-sm mx-auto flex items-center justify-center gap-1.5 bg-purple-500/10 border border-purple-500/20 py-1.5 px-3 rounded-lg">
            <span>💡</span>
            <span>{t("select_class.change_later_hint", "You can always change your class later in Settings")}</span>
          </p>
        </div>

        <ConfettiBurst active={showConfetti} count={60} isPixel={true} color="#a855f7" />

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono text-center shadow-lg">
            {errorMsg}
          </div>
        )}

        <ClassSelector
          isPremium={profile?.is_premium}
          onChoose={handleClassSelection}
        />

        {completeOnboardingMutation.isPending && (
          <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center font-mono text-xs text-purple-300 animate-pulse flex items-center justify-center gap-2">
            <UserCheck className="w-4 h-4 animate-bounce" />
            {t("select_class.initializing", "INITIALIZING NEURAL LINK & SETTING CLASS...")}
          </div>
        )}
      </div>
    </div>
  );
}
