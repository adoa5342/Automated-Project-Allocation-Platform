## 1. Introduction

The **SOFT3888 F16 P42 Student Skill Allocation System** is a full-stack web application developed as part of the University of Sydney’s SOFT3888 Software Engineering course. The purpose of this system is to streamline and automate the process of allocating students to projects based on their skills, interests, and preferences.

The system integrates a **Python-based backend** responsible for data processing and allocation, and a **React-based frontend** that provides an intuitive interface for students and administrators. The application is fully containerized using **Docker**, ensuring consistency and ease of deployment across different environments.

This documentation provides a comprehensive explanation of the system’s purpose, architecture, components, and usage procedures. It is designed to assist future maintainers, evaluators, or clients in understanding the application, even without prior context.

---

## 2. Purpose and Objectives

The primary objective of this project is to create an efficient and user-friendly platform that automates student-project allocation. Traditionally, such allocation processes require significant manual effort and are prone to bias or error. This system leverages algorithmic decision-making to provide a fair, consistent, and data-driven allocation outcome.

Key goals include:
- Collecting student skill data through online surveys.
- Allowing administrators to upload relevant datasets via a web interface or API.
- Automatically processing the data to produce optimized student-project assignments.
- Providing transparent access to results through both web and API interfaces.

---

## 3. System Overview

The system consists of two main components:
1. **Frontend Application (Admin Dashboard & Student Survey)** - a web-based interface developed using React and TailwindCSS that supports both student and administrator interactions.
2. **Backend Service (Allocator)** - a Python service responsible for managing data, running allocation algorithms, and exposing RESTful API endpoints.

Both services are orchestrated through **Docker Compose**, enabling a unified, reproducible environment for development, testing, and deployment.

---

## 4. Functional Capabilities

The Student Skill Allocation System provides the following core functionalities:

1. **User Authentication and Role Management**  
   The system distinguishes between student and administrator roles, allowing restricted access to specific features.
![image](https://github.sydney.edu.au/adoa5342/SOFT3888_F16_04_P42/assets/16521/0022d3d0-931b-4e50-aae6-9ab30e2da669)


2. **Data Collection and Upload**  
   - Students can complete surveys detailing their skills and project preferences.
   ![image](https://github.sydney.edu.au/adoa5342/SOFT3888_F16_04_P42/assets/16521/23370266-324e-4bfb-a869-ee537778ecb0)


  
   - Administrators can upload CSV or ZIP datasets containing student and project data.
  ![image](https://github.sydney.edu.au/adoa5342/SOFT3888_F16_04_P42/assets/16521/c160bec4-6758-4b5d-bd08-8e56399b4505)


3. **Automated Allocation**  
   The backend executes an allocation algorithm that analyzes skill and preference data to assign students to projects optimally.

4. **Result Visualization and Export**  
   Administrators can view allocation outcomes in the dashboard or retrieve them programmatically through the API.
![image](https://github.sydney.edu.au/adoa5342/SOFT3888_F16_04_P42/assets/16521/e6259e1f-8644-4bcc-afda-718e9cb66412)

5. **Containerized Deployment**  
   The entire stack can be built and deployed using Docker, simplifying setup and ensuring cross-platform consistency.

---

## 5. System Architecture

```
SOFT3888_F16_04_P42/
├── admin-dashboard/     # React + TailwindCSS frontend for admin and student interfaces
│   ├── components/      # Reusable UI components such as forms and dashboards
│   ├── pages/           # Application pages and routes
│   ├── styles/          # Tailwind and CSS configuration
│   └── __tests__/       # Unit tests for React components
│
├── allocator/           # Python backend service containing allocation logic
│   ├── app.py           # Main entry point and API route definitions
│   ├── algorithm.py     # Core allocation algorithm implementation
│   └── __init__.py      # Initializes the Python module
│
├── docker-compose.yml   # Orchestrates the frontend and backend containers
├── package.json         # Frontend dependencies and build scripts
└── README.md            # Project documentation
```

---

## 6. Technical Components

### 6.1 Frontend Application (Admin Dashboard)
The frontend is a **React** single-page application styled using **TailwindCSS** and built with **Vite** for optimized performance. It serves as the main interaction layer for users.

#### Key Files and Responsibilities

| File | Description |
|------|--------------|
| `index.html` | Root HTML file that mounts the React application. |
| `index.jsx` | Main entry point for the React application. |
| `login.jsx` | Login interface for users (students or administrators). |
| `survey.jsx` | Student-facing form to input skill and preference data. |
| `result.jsx` | Displays allocation outcomes after processing. |
| `protectedRoute.jsx` | Restricts access to authenticated users. |
| `UsydAdminPanel.jsx` | Administrative dashboard for data management and review. |
| `ResultsDashboard.jsx` | Visual representation of allocation summaries and analytics. |
| `StudentSurvey.jsx` | Manages the survey form’s state and validation. |

#### Testing
The frontend includes Jest-based unit tests located in the `__tests__/` directory to ensure component reliability and correctness.

---

### 6.2 Backend Service (Allocator)
The backend, implemented in Python (typically using Flask or FastAPI), provides API endpoints to handle user interactions and data processing. It executes the matching algorithm responsible for student-project allocation.

#### Core Files and Responsibilities

| File | Description |
|------|--------------|
| `app.py` | Defines API routes and initializes the web server. |
| `algorithm.py` | Contains the logic that performs student-to-project matching based on input data. |
| `__init__.py` | Identifies the directory as a Python module. |

#### API Endpoints

| Endpoint | Method | Function |
|-----------|--------|----------|
| `/api/v1/import` | `POST` | Accepts CSV or ZIP uploads containing input data. |
| `/api/v1/allocate` | `POST` | Triggers the allocation algorithm. |
| `/api/v1/results/:runId` | `GET` | Retrieves the results for a specific allocation run. |

---

## 7. Installation and Deployment

### 7.1 Requirements
To run the project locally, the following software must be installed:
- **Docker** (for containerized deployment)
- **Docker Compose**
- Optionally, **curl** for command-line API testing.

### 7.2 Setup Instructions

To build and deploy all services simultaneously:
```bash
docker-compose up --build
```

After successful startup:
- Access the **frontend** at: `http://localhost:3000`  
- Access the **backend API** at: `http://localhost:5000`

To shut down all running containers:
```bash
docker-compose down
```

---

## 8. Using the System

### 8.1 Uploading Data

The system accepts either individual CSV files or a ZIP archive containing multiple CSV files.

#### Option 1 - Individual File Uploads via API
```bash
curl -X POST http://localhost:3000/api/v1/import -F "file=@users.csv"
curl -X POST http://localhost:3000/api/v1/import -F "file=@skills.csv"
```

#### Option 2 - ZIP Upload via API
```bash
cd test_data
zip import.zip *.csv
curl -X POST http://localhost:3000/api/v1/import -F "file=@import.zip"
```

#### Option 3 - Upload via Web Interface
Visit `http://localhost:3000` and use the upload form to import data files.

---

### 8.2 Running the Allocation Process

#### Option 1 - Command Line (API)
```bash
curl -X POST http://localhost:3000/api/v1/allocate
```

#### Option 2 - Web Interface
Navigate to the web application and select the allocation option.

---

### 8.3 Viewing Results

#### Option 1 - API
Retrieve results for a specific run ID:
```bash
curl -X GET http://localhost:3000/api/v1/results/:runId
```

#### Option 2 - Web Interface
Visit:
```
http://localhost:3000/results
```

---

## 9. Technologies and Frameworks

| Layer | Technologies |
|--------|--------------|
| Frontend | React, TailwindCSS, Vite, Jest |
| Backend | Python, Flask or FastAPI |
| Deployment | Docker, Docker Compose |
| Testing | Jest (frontend), Pytest (optional backend testing) |

---

## 10. System Workflow Summary

1. **User Authentication:** Students and administrators authenticate to access their respective dashboards.  
2. **Data Input:** Administrators or students submit CSV files or survey data.  
3. **Data Processing:** The backend parses and validates the input data.  
4. **Allocation Algorithm Execution:** Student-to-project mapping is computed.  
5. **Result Output:** The final allocation results are displayed in the dashboard and accessible via API.  

This workflow ensures a complete cycle from data entry to results visualization.

---

## 11. Good First Issues (For Onboarding Future Contributors & Future Extensibility)

Looking for a place to start? Try one of these readily available tasks:

- **CSV validation messages:** Improve error hints when admins upload malformed CSVs (e.g., missing headers, wrong delimiter).  
- **Empty-state UIs:** Add friendly placeholders for “no uploads yet” and “no allocations yet” in the dashboard.  
- **Result export UX:** Add a one-click “Download CSV” button on the allocations screen.  
- **Accessibility pass:** Add ARIA labels and keyboard focus traps to modals and forms.  
- **API docs:** Generate or improve OpenAPI docs and link them in the README.  
- **Algorithm unit tests:** Add fixture-based tests for edge cases (oversubscribed projects, conflicting preferences).  
- **Request logging:** Introduce structured logs (request id + timing) for allocation runs.  
- **GitHub Actions:** Add simple CI to run frontend and allocator tests on PRs.

**Label ideas:** `good-first-issue`, `help-wanted`, `area:frontend`, `area:allocator`, `docs`, `testing`.

---

## 12. How to Propose an Allocation Change (Scoring/Rules)

We welcome experiments with the allocator! To propose a rule or weight change:

1. **Describe the intent** (e.g., “increase preference match weight” or “soft cap team size”).  
2. **Edit** `allocator/algorithm.py` (or corresponding module) to add the new weight/constraint, with a **docstring** explaining rationale and trade-offs.  
3. **Add tests** under `allocator/tests/` covering:  
   - a **normal** case,  
   - a **boundary** case (e.g., max team size),  
   - an **abnormal** case (missing data, conflicting constraints).  
4. **Benchmark (optional):** include before/after runtime using the cohort in **`/import_test_data/`**.  
5. **Open a PR** titled `allocator: <short description>` and summarise expected effects (e.g., “+5% first-preference rate”).

---

## 13. Maintenance and Extensibility

The system was designed with modularity in mind. Developers can easily extend or modify the project by:
- Updating frontend components under `admin-dashboard/components`.
- Modifying or replacing the allocation logic in `allocator/algorithm.py`.
- Adjusting container configurations in `docker-compose.yml`.

All configurations and dependencies are declared explicitly, allowing seamless onboarding for new developers.

---

## 14. Licensing and Attribution

This project was developed for academic purposes under the **University of Sydney SOFT3888** course. Redistribution or modification should comply with the university’s licensing policies for coursework and academic projects.

---

## 15. Conclusion

The **SOFT3888 F16 P42 Student Skill Allocation System** demonstrates a practical implementation of a full-stack web application that bridges user interaction, data analysis, and algorithmic processing. By combining modern technologies such as React, Python, and Docker, the system provides a maintainable and scalable solution for academic resource allocation.  

This document serves as a comprehensive reference for future developers, clients, or evaluators to understand the project’s intent, structure, and functionality in detail.
