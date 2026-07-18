// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { djangoApi } from "@/api/djangoClient";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";
import ClassSelector from "@/components/mindos/ClassSelector";
import { Sparkles, UserCheck } from "lucide-react";

export default function SelectClass() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { refreshProfile } = useDjangoAuth();
  const isChanging = location.state?.changingClass;

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
      queryClient.invalidateQueries({ queryKey: ["userprofile"] });
      if (typeof refreshProfile === "function") {
        await refreshProfile();
      }
      navigate("/");
    },
    onError: (err) => {
      setErrorMsg(err?.message || "Initialization failed. Please try again.");
    },
  });

  const handleClassSelection = async (classId) => {
    setErrorMsg(null);
    await completeOnboardingMutation.mutateAsync(classId);
  };

  return (
    <div className="min-h-dvh w-full bg-[#05040a] text-foreground p-4 md:p-8 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden selection:bg-purple-500/30 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 py-6 my-auto">
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            {isChanging ? "CLASS RECALIBRATION" : "SELECT CLASS ARCHITECTURE"}
          </div>

          <h1 className="text-3xl md:text-4xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-purple-300">
            CHOOSE YOUR CLASS
          </h1>
        </div>

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
            INITIALIZING NEURAL LINK & SETTING CLASS...
          </div>
        )}
      </div>
    </div>
  );
}
