import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import SkillsField from "../../components/SkillsField";
import { vi } from "vitest";

describe("SkillsField Component", () => {
  const initialSkills = [
    { id: 1, name: "JavaScript", checked: false, level: 1 },
    { id: 2, name: "React", checked: false, level: 1 },
  ];

  test("renders without crashing", () => {
    render(
      <SkillsField
        skillSetsParam={initialSkills}
        setSkillSetsParam={() => {}}
      />,
    );
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  test("checkbox toggle updates skill checked status", () => {
    const mockSetSkillSetsParam = vi.fn();
    render(
      <SkillsField
        skillSetsParam={initialSkills}
        setSkillSetsParam={mockSetSkillSetsParam}
      />,
    );

    const jsCheckbox = screen.getByLabelText("JavaScript");
    fireEvent.click(jsCheckbox);

    expect(mockSetSkillSetsParam).toHaveBeenCalled();
    expect(mockSetSkillSetsParam).toHaveBeenCalledWith(expect.any(Function));

    // Call the function provided to setSkillSetsParam to simulate state update
    const newStateUpdateFunc = mockSetSkillSetsParam.mock.calls[0][0];
    const newSkillsState = newStateUpdateFunc(initialSkills);
    expect(newSkillsState[0].checked).toBe(true);
  });

  test("displays correct proficiency label when level is set", () => {
    const skillsWithLevelSet = [
      { id: 1, name: "JavaScript", checked: true, level: 3 },
    ];
    render(
      <SkillsField
        skillSetsParam={skillsWithLevelSet}
        setSkillSetsParam={() => {}}
      />,
    );

    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });

  test("checking a skill sets default level correctly", () => {
    const mockSetSkillSetsParam = vi.fn();
    render(
      <SkillsField
        skillSetsParam={initialSkills}
        setSkillSetsParam={mockSetSkillSetsParam}
      />,
    );

    // Click the checkbox for "JavaScript"
    const jsCheckbox = screen.getByLabelText("JavaScript");
    fireEvent.click(jsCheckbox);

    // Capture updater and apply to current state
    expect(mockSetSkillSetsParam).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSetSkillSetsParam.mock.calls[0][0];
    const updatedState = updater(initialSkills);

    // Assert: becomes checked and level defaults to 1 (Beginner)
    expect(updatedState[0].checked).toBe(true);
    expect(updatedState[0].level).toBe(1);
  });

  // NEW: clicking a level button updates the level (covers setSkillLevel)
  test("clicking a level button updates level to the selected value", () => {
    const skills = [{ id: 1, name: "JavaScript", checked: true, level: 1 }];
    const mockSetSkillSetsParam = vi.fn();

    render(
      <SkillsField
        skillSetsParam={skills}
        setSkillSetsParam={mockSetSkillSetsParam}
      />,
    );

    // Scope to the JavaScript row, then find the 5 level buttons
    const labelEl = screen.getByText("JavaScript").closest("label");
    const row = labelEl ? labelEl.parentElement : null;
    expect(row).not.toBeNull();

    const levelButtons = within(row).getAllByRole("button");
    // Click the 4th button -> level should become 4
    fireEvent.click(levelButtons[3]);

    expect(mockSetSkillSetsParam).toHaveBeenCalledWith(expect.any(Function));
    const updater = mockSetSkillSetsParam.mock.calls.at(-1)[0];
    const updated = updater(skills);
    expect(updated[0].level).toBe(4);
  });

  // NEW: multiple clicks change level each time
  test("subsequent clicks change the level accordingly", () => {
    const skills = [{ id: 1, name: "JavaScript", checked: true, level: 1 }];
    const mockSetSkillSetsParam = vi.fn();

    render(
      <SkillsField
        skillSetsParam={skills}
        setSkillSetsParam={mockSetSkillSetsParam}
      />,
    );

    const labelEl = screen.getByText("JavaScript").closest("label");
    const row = labelEl ? labelEl.parentElement : null;
    expect(row).not.toBeNull();

    const levelButtons = within(row).getAllByRole("button");

    // Click 2nd button => level 2
    fireEvent.click(levelButtons[1]);
    expect(mockSetSkillSetsParam).toHaveBeenCalledWith(expect.any(Function));
    const updater1 = mockSetSkillSetsParam.mock.calls[0][0];
    const state1 = updater1(skills);
    expect(state1[0].level).toBe(2);

    // Click 5th button => level 5
    fireEvent.click(levelButtons[4]);
    const updater2 = mockSetSkillSetsParam.mock.calls[1][0];
    const state2 = updater2(state1);
    expect(state2[0].level).toBe(5);
  });
});
