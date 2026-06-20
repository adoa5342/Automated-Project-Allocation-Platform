import {Router} from "express";
import {prisma} from "../server.js";

import cors from 'cors';
import jwt from "jsonwebtoken";

import * as bcrypt from 'bcrypt';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

router.post('/', async (req, res) => {
    try {
        const {username, password} = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                ok: false, 
                message: 'Username and password are required' 
            });
        }

        const account = await prisma.account.findUnique({
            where: {username},
        });

        if (account && await bcrypt.compare(password, account.password)) {
            const token = jwt.sign(
                { userId: account.id, username: account.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ok: true, message: 'Valid', token, user: { id: account.id, username: account.username, role: account.role }});

        } else {
            res.json({ok: false, message: 'Invalid'});
        }

    } catch (error) {
        console.error('Error finding corresponding account:', error);
        res.status(500).json({ ok: false, error: 'Failed to find account' });
    }
});

export default router;