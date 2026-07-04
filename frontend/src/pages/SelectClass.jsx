import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { djangoApi } from "@/api/djangoClient";
import { queryClientInstance } from "@/lib/query-client";
import ClassSelector from "@/components/mindos/ClassSelector";

export default function SelectClass() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChanging = location.state?.changingClass;
  const [errorMsg, setErrorMsg] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ["userprofile"],
    queryFn: () => djangoApi.profile.get()
  });

  const mutation = useMutation({
    mutationFn: async (classId) => {
      return djangoApi.profile.update({ character_class: classId });
    },
    onSuccess: (data, classId) => {
      queryClientInstance.setQueryData(["userprofile"], (old) => {
        if (!old) return old;
        return { ...old, character_class: classId };
      });
      queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
      navigate("/");
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to select class. Please try again.");
    }
  });

  return (
    <div className="h-full w-full bg-[#05040a] text-foreground p-6 flex flex-col items-center justify-start md:justify-center relative overflow-y-auto overflow-x-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="w-full max-w-3xl relative z-10 my-auto py-8">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            {isChanging ? "CLASS RECALIBRATION" : "SYSTEM INITIALIZATION"}
          </h1>
          <p className="text-sm font-mono text-muted-foreground">
            {isChanging ? "Please select a new baseline neural architecture." : "Please define your baseline neural architecture."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono text-center">
            {errorMsg}
          </div>
        )}

        <ClassSelector 
          isPremium={profile?.is_premium}
          onChoose={async (classId) => {
            await mutation.mutateAsync(classId);
          }} 
        />
        
        {mutation.isPending && (
          <div className="mt-6 text-center font-mono text-sm text-indigo-400 animate-pulse">
            Processing selection...
          </div>
        )}
      </div>
    </div>
  );
}
