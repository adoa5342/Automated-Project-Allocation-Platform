import React from "react";

function StudentField({
  index,
  removable = false,
  onRemove,
  register,
  studentError,
  student,
  emailRootError,
}) {
  return (
    <div className="mt-3 font-normal">
      <fieldset className="relative rounded-xl border border-gray-300 p-4 pt-0">
        <legend className="flex items-center justify-between font-semibold text-blue-900">
          Student {index}
        </legend>
        {removable && (
          <button
            type="button"
            onClick={() => onRemove?.()}
            className="absolute right-10 rounded-md bg-red-600 text-base text-white hover:bg-red-700"
          >
            {" "}
            Remove{" "}
          </button>
        )}

        <div>
          <label htmlFor={`fullName-${index}`} className="block pt-4">
            Full name:
          </label>
          <input
            id={`fullName-${index}`}
            name={`fullName-${index}`}
            type="text"
            placeholder="e.g. Michael Jordan"
            {...register(`${student}.fullName`)}
          />
          {studentError?.fullName && (
            <p className="mb-5 text-base text-red-600">
              {studentError.fullName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`email-${index}`} className="block">
            {" "}
            Student Email:{" "}
          </label>
          <input
            id={`email-${index}`}
            name={`email-${index}`}
            type="text"
            placeholder="e.g. student123@uni.sydney.edu.au"
            {...register(`${student}.email`)}
          />
          {studentError?.email && (
            <p className="mb-5 text-base text-red-600">
              {studentError.email.message}
            </p>
          )}
          {emailRootError && (
            <p className="mb-5 text-base text-red-600">{emailRootError}</p>
          )}
        </div>

        <div>
          <label htmlFor={`cohort-${index}`} className="block">
            {" "}
            Cohort:{" "}
          </label>
          <input
            id={`cohort-${index}`}
            name={`cohort-${index}`}
            type="text"
            placeholder="e.g. 2024, 2025"
            {...register(`${student}.cohort`)}
          />
          {studentError?.cohort && (
            <p className="mb-5 text-base text-red-600">
              {studentError.cohort.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`role-${index}`} className="block">
            {" "}
            Role:{" "}
          </label>
          <input
            id={`role-${index}`}
            name={`role-${index}`}
            type="text"
            placeholder="Leader / Member etc"
            {...register(`${student}.role`)}
          />
          {studentError?.role && (
            <p className="mb-5 text-base text-red-600">
              {studentError.role.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`seniority-${index}`} className="block">
            {" "}
            Seniority:{" "}
          </label>
          <select
            id={`seniority-${index}`}
            name={`seniority-${index}`}
            className="hover: cursor-pointer"
            {...register(`${student}.seniority`)}
          >
            <option value="" disabled>
              {" "}
              — Select year —{" "}
            </option>
            <option value="1">First year</option>
            <option value="2">Second year</option>
            <option value="3">Third year</option>
            <option value="4">Fourth year+</option>
          </select>
          {studentError?.seniority && (
            <p className="mb-5 text-base text-red-600">
              {studentError.seniority.message}
            </p>
          )}
        </div>
      </fieldset>
    </div>
  );
}

export default StudentField;
