import express from "express";
import path from "path";
import cors from "cors";
import fileUpload from "express-fileupload";
import {PrismaClient} from "@prisma/client";

import importRouter from "./routes/import.js";
import allocateRouter from "./routes/allocate.js";
import resultsRouter from "./routes/results.js";
import databaseRouter from "./routes/database.js" 
import allocationHistoryRouter from "./routes/allocationHistory.js";
import studentSurveyRouter from "./routes/student-survey.js";
import loginRouter from "./routes/login.js";
import { authenticate } from "./middleware/auth.js";

export const prisma = new PrismaClient();
export const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

app.use(fileUpload({useTempFiles: true, tempFileDir: "/tmp", debug: true}));
app.use(express.json({limit: "10mb"}));

app.use("/api/v1/login", loginRouter);

app.use("/api/v1/import", authenticate, importRouter);
app.use("/api/v1/allocate", authenticate, allocateRouter);
app.use("/api/v1/results", authenticate, resultsRouter);
app.use("/api/v1/database", authenticate, databaseRouter);
app.use('/api/v1/allocation/history', authenticate, allocationHistoryRouter);

app.use("/api/v1/student-survey", studentSurveyRouter);

// app.use(express.static(path.join(process.cwd(), 'public')));

// app.get('/', (req, res) => {
//   res.redirect('/index.html');
// });

app.get('/api-docs.yaml', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi.yaml'));
});

const PORT = Number(process.env.PORT || 3000);
const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
if (!isTestEnv) {
  app.listen(PORT, () => console.log(`Backend Listening On :${PORT}`));
}
