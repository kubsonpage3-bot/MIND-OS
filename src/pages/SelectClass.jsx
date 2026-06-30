import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { djangoApi } from "@/api/djangoClient";
import { queryClientInstance } from "@/lib/query-client";
import ClassSelector from "@/components/mindos/ClassSelector";

export default function SelectClass() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState(null);

  const mutation = useMutation({
    mutationFn: async (classId) => {
      return djangoApi.profile.update({ character_class: classId });
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
      navigate("/");
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to select class. Please try again.");
    }
  });

  return (
    <div className="min-h-screen bg-[#05040a] text-foreground p-6 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="w-full max-w-3xl relative z-10">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            SYSTEM INITIALIZATION
          </h1>
          <p className="text-sm font-mono text-muted-foreground">
            Please define your baseline neural architecture.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono text-center">
            {errorMsg}
          </div>
        )}

        <ClassSelector 
          onChoose={(classId) => mutation.mutate(classId)} 
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
