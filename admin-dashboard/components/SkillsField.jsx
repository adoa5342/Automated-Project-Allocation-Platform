import React from "react";

const LEVEL_LABELS = [
  "Beginner",
  "Novice",
  "Intermediate",
  "Advanced",
  "Expert",
];

function SkillsField({ skills, skillSetsParam, setSkillSetsParam }) {
  // function to make particular skill set checked if its corresponding checkbox is ticked
  function checkBoxProceed(id, checked) {
    setSkillSetsParam((skillSetsParam) =>
      skillSetsParam.map((skillSet) =>
        skillSet.id === id ? { ...skillSet, checked } : skillSet,
      ),
    );
  }

  // function to update prociency level of particular skill if user change it
  function setSkillLevel(id, level) {
    setSkillSetsParam((skillSetsParam) =>
      skillSetsParam.map((skillSet) =>
        skillSet.id === id ? { ...skillSet, level } : skillSet,
      ),
    );
  }

  return (
    <div className="divide-y divide-gray-300 border-b border-gray-300">
      {skillSetsParam.map((skillSet) => (
        // <div key={skillSet.id} className="flex flex-wrap items-center gap-4 py-3" >
        <div key={skillSet.id} className="items-center gap-4 py-3">
          {/* skill names with their checkboxes */}
          <label className="flex items-center gap-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={skillSet.checked}
              onChange={(e) => checkBoxProceed(skillSet.id, e.target.checked)}
              className="size-7 accent-[#1A365D] hover:cursor-pointer"
            />
            <span className="font-medium text-gray-900">{skillSet.name}</span>
          </label>

          {/* proficiency level appear when corresponding skill is checked */}
          {skillSet.checked && (
            // <div className="flex items-center gap-2 ">
            <div className="mt-2 flex items-center gap-2">
              <span className="text-base text-gray-600">
                Proficiency level:
              </span>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSkillLevel(skillSet.id, level)}
                    className={`h-7 w-7 rounded-md border transition ${skillSet.level >= level ? "border-[#1A365D] bg-[#1A365D]" : "border-gray-300 bg-white hover:border-gray-400"}`}
                  />
                ))}
              </div>

              <span className="ml-1 text-base text-gray-700">
                {" "}{LEVEL_LABELS[skillSet.level - 1]}{" "}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default SkillsField;
