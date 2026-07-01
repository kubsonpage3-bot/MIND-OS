import os

replacements = {
    "pages/Achievements.jsx": [
        (
            'import { ACHIEVEMENTS, loadRPGData } from "@/lib/rpgSystem";',
            'import { loadRPGData } from "@/lib/rpgSystem";\nimport { ACHIEVEMENTS } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/AchievementsPanel.jsx": [
        (
            'import { ACHIEVEMENTS, loadRPGData } from "@/lib/rpgSystem";',
            'import { loadRPGData } from "@/lib/rpgSystem";\nimport { ACHIEVEMENTS } from "@/constants/rpgData";',
        )
    ],
    "components/navigation/CharacterStatusBar.jsx": [
        (
            'import { CLASSES } from "@/lib/rpgSystem";',
            'import { CLASSES } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/CharacterHub.jsx": [
        (
            'import { CLASSES } from "@/lib/rpgSystem";',
            'import { CLASSES } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/SkillPanel.jsx": [
        (
            'import { CLASSES } from "@/lib/rpgSystem";',
            'import { CLASSES } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/MutatorsPanel.jsx": [
        (
            'import { MUTATORS, saveRPGData } from "@/lib/rpgSystem";',
            'import { saveRPGData } from "@/lib/rpgSystem";\nimport { MUTATORS } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/PixelCharacter.jsx": [
        (
            'import { CLASS_SPRITES, RANK_CHARACTER_FILTERS } from "@/lib/rpgSystem";',
            'import { CLASS_SPRITES, RANK_CHARACTER_FILTERS } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/ClassSelector.jsx": [
        (
            'import { CLASSES, CLASS_SPRITES } from "@/lib/rpgSystem";',
            'import { CLASSES, CLASS_SPRITES } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/SkillTreePanel.jsx": [
        (
            'import { SKILL_TREE, saveRPGData } from "@/lib/rpgSystem";',
            'import { saveRPGData } from "@/lib/rpgSystem";\nimport { SKILL_TREE } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/AlliesPanel.jsx": [
        (
            'import { ALLIES, saveRPGData } from "@/lib/rpgSystem";',
            'import { saveRPGData } from "@/lib/rpgSystem";\nimport { ALLIES } from "@/constants/rpgData";',
        )
    ],
    "components/mindos/CharacterTab.jsx": [
        (
            'import { loadRPGData, saveRPGData, CLASSES } from "@/lib/rpgSystem";',
            'import { loadRPGData, saveRPGData } from "@/lib/rpgSystem";\nimport { CLASSES } from "@/constants/rpgData";',
        )
    ],
}

for path, rules in replacements.items():
    full_path = os.path.join("frontend/src", path)
    if os.path.exists(full_path):
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        for old, new in rules:
            content = content.replace(old, new)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {full_path}")
    else:
        print(f"Not found: {full_path}")
