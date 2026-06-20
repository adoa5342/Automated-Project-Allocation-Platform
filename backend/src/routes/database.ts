import {Router} from "express";
import cors from 'cors';
import {clearDatabase, fetchRecords} from "../services/utils.js";

const router = Router();

router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

router.post("/", async (req, res) => {
    try {
        await clearDatabase();
        return res.json({ok: true});
    } catch (e: any) {
    console.error("Clear database failed:", e);
    return res.status(500).json({ok: false, error: e?.message ?? "Internal Error"});
  }
});

router.post("/records", async (req, res) => {
    try {
        console.log(req.body);
        const {table, args} = req.body || {};
        const records = await fetchRecords(table);
        console.log(records);
        return res.json({ok: true, data: records});
    } catch (e: any) {
        console.error("Cannot fetch corresponding records:", e);
        return res.status(500).json({ok: false, error: e?.message ?? "Internal Error"});
    }
});

export default router;
