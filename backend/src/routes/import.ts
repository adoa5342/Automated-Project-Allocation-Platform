import {Router} from "express";
import cors from 'cors';
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import {runImport} from "../services/importer.js";
import axios from "axios";
import { Request, Response } from 'express';

const router = Router();

const CANONICAL = [
  "users.csv", "skills.csv", "projects.csv", "project_required_skills.csv",
  "groups.csv", "group_members.csv", "user_skills.csv", "group_preferences.csv",
  "group_availability.csv", "criteria_weights.csv", "locks.csv", "group_tags.csv"
];

// Helper Functions

function toCanonicalName(incoming: string | undefined): string | undefined {
  if (!incoming) return;
  const lower = incoming.toLowerCase().trim();
  const exact = CANONICAL.find(n => n.toLowerCase() === lower);
  if (exact) return exact;
  const stem = lower.replace(/\.csv$/i, "");
  return CANONICAL.find(n => n.replace(/\.csv$/i, "") === stem);
}

router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

router.post("/", async (req, res) => {
  try {
    const filesMap: Record<string, string> = {};
    const f: any = (req as any).files?.file;

    if (f && (f.mimetype === "application/zip" || f.name?.endsWith(".zip"))) {
      const zip = new AdmZip(f.tempFilePath);
      const tmp = path.join("/tmp", `import_${Date.now()}`);
      fs.mkdirSync(tmp);
      zip.extractAllTo(tmp, true);

      const want = new Map(CANONICAL.map(n => [n.toLowerCase(), n]));

      // tiny recursive walker
      function walk(dir: string): string[] {
        const out: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) out.push(...walk(full));
          else out.push(full);
        }
        return out;
      }

      const allExtracted = walk(tmp);
      console.log("Extracted files:", allExtracted.map(p => path.relative(tmp, p)));

      for (const abs of allExtracted) {
        const base = path.basename(abs).toLowerCase();
        if (want.has(base) && !filesMap[want.get(base)!]) {
          filesMap[want.get(base)!] = abs; // map canonical name to absolute path
        }
      }

      for (const name of CANONICAL) {
        const p = path.join(tmp, name);
        if (fs.existsSync(p)) filesMap[name] = p;
      }

    } else {
      
      for (const key in ((req as any).files ?? {})) {
        const fileOrFiles = (req as any).files[key];
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

        for (const file of files) {
          filesMap[file.name] = file.tempFilePath;
        }
      }
    }

    console.log(filesMap)

    const report = await runImport(filesMap, true);
    if (!report.ok) return res.status(400).json(report);

    res.json(report);

  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post("/csv", async (req: Request, res: Response) => {
  try {
    const files = (req as any).files;
    if (!files) return res.status(400).json({ ok: false, error: "No file uploaded" });

    const primary = (files.file ?? files.csv ?? null) as any | null;
    const fileSet: Record<string, string> = {};

    const addCsv = (name: string, tempFilePath: string) => {
      const canonical = toCanonicalName(name);
      if (!canonical) {
        // throw new Error(
        //   `Unrecognised CSV "${name}". Expected one of: ${CANONICAL.join(", ")}`
        // );
        console.log("Unrecognised CSV:", name);
        return
      }
      fileSet[canonical] = tempFilePath;
    };

    let isBatchUpload = false;

    if (primary && typeof primary.name === "string") {
      const name = primary.name.toLowerCase();

      if (name.endsWith(".zip")) {
        isBatchUpload = true;
        const tmp = path.join("/tmp", `import_${Date.now()}`);

        fs.mkdirSync(tmp, { recursive: true });
        const zip = new AdmZip(primary.tempFilePath);
        zip.extractAllTo(tmp, true);

        const findCsvFiles = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
              findCsvFiles(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
              addCsv(entry.name, fullPath);
            }
          }
        };

        findCsvFiles(tmp);

        for (const expected of CANONICAL) {
          const p = path.join(tmp, expected);
          if (fs.existsSync(p)) fileSet[expected] = p;
        }
      } else if (name.endsWith(".csv")) {
        addCsv(primary.name, primary.tempFilePath);
      } else {
        return res.status(400).json({ok: false, error: "Upload a .csv or .zip file"});
      }
    } else {
      for (const [key, value] of Object.entries(files)) {
        const f = value as any;
        const arr = Array.isArray(f) ? f : [f];
        for (const item of arr) {
          if (!item?.name?.toLowerCase().endsWith(".csv")) {
            return res.status(400).json({ ok: false, error: `Unsupported file "${item?.name}". Only CSVs (or a ZIP of CSVs) are allowed.` });
          }
          addCsv(item.name, item.tempFilePath);
        }
      }
    }

    if (Object.keys(fileSet).length === 0) {
      return res.status(400).json({ ok: false, error: "No recognised CSVs found to import" });
    }

    const response = await runImport(fileSet, isBatchUpload);
    if (!response?.ok) return res.status(400).json(response ?? { ok: false, error: "Import Failed" });

    return res.json(response);
  } catch (err: any) {
    console.error("Single CSV Upload Error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
});

export default router;
