import {Router} from "express";
import {prisma} from "../server.js";
import cors from 'cors';

const router = Router();

// Modification: Allow cross-origin requests from all sources (development environment configuration)
router.use(cors({
    origin: '*', // Allow requests from any IP address and port
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));
  
// GET all projects
router.get('/projects', async (req, res) => {
    try {
        const projects = await prisma.project.findMany();
        res.json({ok: true, data: projects});
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ ok: false, error: 'Failed to fetch projects' });
    }
});

// GET all projects
router.get('/groups', async (req, res) => {
    try {
        const groups = await prisma.group.findMany();
        res.json({ok: true, data: groups});
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ok: false, error: 'Failed to fetch groups'});
    }
});

// POST submit preferences
router.post('/preferences', async (req, res) => {
    try {
    console.log('Request Body:', req);

      const {groupId, preferences, availability} = req.body;
      console.log('Request Body:', req.body);
      console.log('groupIdValue:', req.body.groupId);
      // Verify required parameters
      if (!groupId) {
        return res.status(400).json({ok: false, error: 'groupId is required'});
      }
      
      // Ensure preferences is an array and provide default values.
      const prefsArray = Array.isArray(preferences) ? preferences : [];
      const availArray = Array.isArray(availability) ? availability : [];
      
      // Verify that the array is not empty
      if (prefsArray.length === 0) {
        return res.status(400).json({ok: false, error: 'preferences array cannot be empty'});
      }
      
      if (availArray.length === 0) {
        return res.status(400).json({ok: false, error: 'availability array cannot be empty'});
      }
      
      // Save Project Preferences
      const preferenceRecords = [];
      for (const pref of prefsArray) {  // Use the validated array
        // Validate a single preference object
        if (!pref.projectId || pref.rank === undefined) {
          return res.status(400).json({ 
            ok: false, 
            error: `Invalid preference object: ${JSON.stringify(pref)}` 
          });
        }
        
        const record = await prisma.groupPreference.upsert({
          where: {
            groupId_projectId: {
              groupId,
              projectId: pref.projectId
            }
          },
          update: {
            rank: pref.rank
          },
          create: {
            groupId,
            projectId: pref.projectId,
            rank: pref.rank || null
          }
        });
        preferenceRecords.push(record);
      }
      
      // Storage Availability Data
      const availabilityRecords = [];
      for (const avail of availArray) {  // Use the validated array
        // Verify a single availability object
        if (!avail.fromWeek || !avail.toWeek || !avail.hoursPerWeek) {
          return res.status(400).json({ 
            ok: false, 
            error: `Invalid availability object: ${JSON.stringify(avail)}` 
          });
        }
        
        const record = await prisma.groupAvailability.upsert({
          where: {
            groupId_fromWeek_toWeek_hoursPerWeek: {
              groupId,
              fromWeek: avail.fromWeek,
              toWeek: avail.toWeek,
              hoursPerWeek: avail.hoursPerWeek
            }
          },
          update: {},
          create: {
            groupId,
            fromWeek: avail.fromWeek,
            toWeek: avail.toWeek,
            hoursPerWeek: avail.hoursPerWeek
          }
        });
        availabilityRecords.push(record);
      }
      
      res.json({ 
        ok: true, 
        data: {
          preferences: preferenceRecords,
          availability: availabilityRecords
        } 
      });
    } catch (error) {
      console.error('Error submitting preferences:', error);
      res.status(500).json({ ok: false, error: 'Failed to submit preferences' });
    }
  });
export default router;


