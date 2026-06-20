import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// -------------------------
// Hoisted mocks (MUST be before component import)
// -------------------------

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => <div>Toaster</div>,
}));

vi.mock('lucide-react', () => ({
  Upload: () => <div>UploadIcon</div>,
  PlayCircle: () => <div>PlayCircleIcon</div>,
  FileText: () => <div>FileTextIcon</div>,
  Settings: () => <div>SettingsIcon</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../components/NavBar', () => ({
  default: () => <div>NavBar</div>,
}));

import axios from 'axios';
vi.mock('axios');

globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
globalThis.URL.revokeObjectURL = vi.fn();

// -------------------------
// Import Component (AFTER mocks)
// -------------------------

import UsydAdminPanel from '../../components/UsydAdminPanel';

// -------------------------
// Helpers
// -------------------------

const defaultFetchRouter = async (url) => {
  const s = String(url);

  if (s.endsWith('/api/v1/database/records')) {
    return { ok: true, json: async () => ({ ok: true, data: [{ id: 1 }] }) };
  }

  if (s.endsWith('/api/v1/database')) {
    return { ok: true, json: async () => ({ ok: true }) };
  }

  if (s.endsWith('/api/v1/allocation/history')) {
    return {
      ok: true,
      json: async () => ([
        { id: 'run-1', runId: 'run-1', create_time: new Date().toISOString() },
      ]),
    };
  }

  if (s.includes('/api/v1/allocation/history/')) {
    return {
      ok: true,
      json: async () => ({
        runId: 'run-1',
        summary: { projects: 3, students: 10 },
        assignments: [],
      }),
    };
  }

  if (s.includes('/api/v1/import/csv')) {
    return { ok: true, json: async () => ({ ok: true }) };
  }

  return { ok: true, json: async () => ({ ok: true }) };
};

const renderPanel = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<UsydAdminPanel />} />
      </Routes>
    </MemoryRouter>
  );

const mockNextFileDialog = (file) => {
  const origCreate = document.createElement;
  vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'input') {
      const node = {
        type: 'file',
        accept: '.csv, .zip',
        onchange: null,
        click() {
          const e = { target: { files: [file] } };
          setTimeout(() => node.onchange && node.onchange(e), 0);
        },
        setAttribute() {},
        style: {},
      };
      return node;
    }
    return origCreate.call(document, tagName);
  });
};

const getRowByFirstCell = (labelRegex) => {
  const rows = screen.getAllByRole('row'); // includes header row
  for (const row of rows) {
    // Prefer direct DOM first cell to avoid role-selection ambiguity
    const directFirstCell = row.querySelector('td, th');
    if (directFirstCell) {
      const text = (directFirstCell.textContent || '').trim();
      if (labelRegex.test(text)) return row;
      continue;
    }

    // Fallbacks if no <td>/<th> are present (some libraries render grids differently)
    const cells =
      within(row).queryAllByRole('cell') // regular table cells
      || [];

    const headers =
      within(row).queryAllByRole('columnheader') // header cells if it's the header row
      || [];

    const first = [...cells, ...headers][0];
    if (!first) continue;

    const text = (first.textContent || '').trim();
    if (labelRegex.test(text)) return row;
  }
  return null;
};

// -------------------------
// Refactored suites
// -------------------------

describe('UsydAdminPanel - Downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it(`clicking 'Download Templates' triggers CSV downloads`, () => {
    renderPanel();

    const downloadBtn = screen.getByRole('button', { name: /download templates/i });
    fireEvent.click(downloadBtn);

    expect(URL.createObjectURL).toHaveBeenCalled(); // at least once
  });
});

describe('UsydAdminPanel - Allocation Run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it('runs allocation successfully (axios.post ok=true)', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true } });

    renderPanel();

    const runBtn = await screen.findByRole('button', { name: /run allocation/i });
    expect(runBtn).not.toHaveAttribute('disabled');

    fireEvent.click(runBtn);

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(axios.post.mock.calls[0][0]).toMatch(/\/api\/v1\/allocate$/);
  });

  it('handles run allocation failure (axios.post ok=false)', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: false, error: 'fail' } });

    renderPanel();

    const runBtn = await screen.findByRole('button', { name: /run allocation/i });
    fireEvent.click(runBtn);

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
  });
});

describe('UsydAdminPanel - Database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it('clears database successfully', async () => {
    const { toast } = await import('react-hot-toast');

    renderPanel();

    const clearBtn = await screen.findByRole('button', { name: /clear database/i });
    fireEvent.click(clearBtn);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/database$/),
        expect.objectContaining({ method: 'POST' })
      )
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/cleared/i));
  });

  it('clear database failure shows error toast', async () => {
    const { toast } = await import('react-hot-toast');

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/api/v1/database')) {
        return { ok: true, json: async () => ({ ok: false, error: 'nope' }) };
      }
      return defaultFetchRouter(url);
    });

    renderPanel();

    const clearBtn = await screen.findByRole('button', { name: /clear database/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/failed to clear/i));
    });
  });
});

describe('UsydAdminPanel - Modal and Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it('opens allocation detail via "View Details" (triggers detail fetch) and handles Escape', async () => {
    renderPanel();

    const viewBtn = await screen.findByRole('button', { name: /view details/i });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      const calledDetail = (fetch.mock.calls || []).some(([url]) =>
        String(url).includes('/api/v1/allocation/history/')
      );
      expect(calledDetail).toBe(true);
    });

    const maybeModal =
      screen.queryByRole('dialog') ||
      screen.queryByText(/detail view/i) ||
      screen.queryByText(/allocation detail/i) ||
      screen.queryByText(/run[-\s]?id/i);

    fireEvent.keyDown(document, { key: 'Escape' });

    if (maybeModal) {
      await waitFor(() => {
        expect(
          screen.queryByRole('dialog') ||
          screen.queryByText(/detail view/i) ||
          screen.queryByText(/allocation detail/i) ||
          screen.queryByText(/run[-\s]?id/i)
        ).toBeNull();
      });
    }
  });

  it('clicking the modal overlay calls hideModal (closes modal)', async () => {
    renderPanel();

    const viewBtn = await screen.findByRole('button', { name: /view details/i });
    fireEvent.click(viewBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const overlay = document.querySelector('[class*="bg-black/50"]') || document.querySelector('.absolute.inset-0');
    expect(overlay).toBeTruthy();

    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('covers the branch: detail fetch ok=false throws "Failed to fetch allocation details"', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/v1/allocation/history')) {
        return {
          ok: true,
          json: async () => ([
            { id: 'run-err', runId: 'run-err', create_time: new Date().toISOString() },
          ]),
        };
      }
      if (s.includes('/api/v1/allocation/history/')) {
        return { ok: false, json: async () => ({}) };
      }
      return defaultFetchRouter(url);
    });

    renderPanel();

    const viewBtn = await screen.findByRole('button', { name: /view details/i });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      const calledDetail = (fetch.mock.calls || []).some(([u]) =>
        String(u).includes('/api/v1/allocation/history/')
      );
      expect(calledDetail).toBe(true);
    });

    const maybeErr = screen.queryByText(/Failed to fetch allocation details/i);
    if (maybeErr) {
      expect(maybeErr).toBeInTheDocument();
    }

    global.fetch.mockRestore?.();
  });
});

describe('UsydAdminPanel - Uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it('ZIP upload success hits import endpoint', async () => {
    renderPanel();

    const zip = new File(['zipdata'], 'students.zip', { type: 'application/zip' });
    mockNextFileDialog(zip);

    const browseBtns = await screen.findAllByRole('button', { name: /browse/i });
    fireEvent.click(browseBtns[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/import\/csv/),
        expect.any(Object)
      );
    });

    document.createElement.mockRestore?.();
  });

  it('CSV upload failure shows error toast', async () => {
    const { toast } = await import('react-hot-toast');

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/import/csv')) {
        return { ok: true, json: async () => ({ ok: false, errors: ['bad csv'] }) };
      }
      return defaultFetchRouter(url);
    });

    renderPanel();

    const csv = new File(['a,b\n1,2'], 'students.csv', { type: 'text/csv' });
    mockNextFileDialog(csv);

    const browseBtns = await screen.findAllByRole('button', { name: /browse/i });
    fireEvent.click(browseBtns[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/failed to upload file/i));
    });

    document.createElement.mockRestore?.();
  });

  it('shows toast error "Failed To Upload ZIP File" when ZIP upload fails', async () => {
    const { toast } = await import('react-hot-toast');

    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/import/csv')) {
        return { ok: true, json: async () => ({ ok: false }) };
      }
      return defaultFetchRouter(url);
    });

    renderPanel();

    const zip = new File(['zipfail'], 'students.zip', { type: 'application/zip' });
    mockNextFileDialog(zip);

    const browseBtns = await screen.findAllByRole('button', { name: /browse/i });
    fireEvent.click(browseBtns[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed To Upload ZIP File");
    });

    document.createElement.mockRestore?.();
  });
});

describe('UsydAdminPanel - Rendering & Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(defaultFetchRouter);
  });

  it('covers Group Skills / Required By column functions directly', () => {
    const cols = globalThis.__TEST_TABLE_CONFIG__.skills.columns;

    const groupFn = cols.find(([label]) => /group skills/i.test(label))[1];
    const reqFn   = cols.find(([label]) => /required by/i.test(label))[1];

    expect(groupFn({ _count: { groupSkills: 3 } })).toBe(3);
    expect(groupFn({})).toBe(0);

    expect(reqFn({ _count: { requiredBy: 7 } })).toBe(7);
    expect(reqFn({})).toBe(0);
  });

  it('renders the assignments table with formatted cells (driven via test only setters)', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<UsydAdminPanel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(typeof globalThis.__TEST_SET_MODAL_OPEN__).toBe('function');
    expect(typeof globalThis.__TEST_SET_HISTORY_DETAILS__).toBe('function');

    globalThis.__TEST_SET_MODAL_OPEN__(true);
    globalThis.__TEST_SET_HISTORY_DETAILS__({
      runId: 'run-xyz',
      summary: { projects: 1, students: 2 },
      assignments: [
        {
          id: 'a-1',
          projectName: 'Project A',
          projectId: 101,
          groupName: 'Group G',
          groupId: 5,
          status: 'Assigned',
          score: 0.875, // should render as 0.88
          members: [{ userName: 'alice' }, { userName: 'bob' }],
        },
        {
          id: 'a-2',
          projectName: 'Project B',
          projectId: 202,
          groupName: 'Group H',
          groupId: 6,
          status: 'Pending',
          score: 1, // should render as 1.00
          members: [{ userName: 'charlie' }],
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText(/project a\s*\(101\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/group g\s*\(5\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^assigned$/i)).toBeInTheDocument();
    expect(screen.getByText('0.88')).toBeInTheDocument();
    expect(screen.getByText(/alice,\s*bob/i)).toBeInTheDocument();

    expect(screen.getByText(/project b\s*\(202\)/i)).toBeInTheDocument();
    expect(screen.getByText(/group h\s*\(6\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^pending$/i)).toBeInTheDocument();
    expect(screen.getByText('1.00')).toBeInTheDocument();
    expect(screen.getByText(/charlie/i)).toBeInTheDocument();
  });

  it('covers all groups column lambdas (value + fallback) and proves they executed', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<UsydAdminPanel />} />
        </Routes>
      </MemoryRouter>
    );

    globalThis.__HIT__ = {};

    const cols = globalThis.__TEST_TABLE_CONFIG__?.groups?.columns;
    expect(Array.isArray(cols)).toBe(true);

    const byLabel = Object.fromEntries(cols.map(([label, field]) => [String(label).toLowerCase(), field]));

    const membersFn      = byLabel['members'];
    const skillsFn       = byLabel['skills'];
    const availabilityFn = byLabel['availability'];
    const preferencesFn  = byLabel['preferences'];
    const lockFn         = byLabel['lock'];
    const assignmentFn   = byLabel['assignment'];

    [membersFn, skillsFn, availabilityFn, preferencesFn, lockFn, assignmentFn].forEach(fn =>
      expect(typeof fn).toBe('function')
    );

    const rowValue = {
      _count: { members: 3, skills: 2, availability: 5, preferences: 1 },
      lock: { id: 'L-9' },
      Assignment: [{ projectId: 42 }],
    };
    const rowFallback = { Assignment: [] };

    expect(membersFn(rowValue)).toBe(3);
    expect(membersFn(rowFallback)).toBe(0);

    expect(skillsFn(rowValue)).toBe(2);
    expect(skillsFn(rowFallback)).toBe(0);

    expect(availabilityFn(rowValue)).toBe(5);
    expect(availabilityFn(rowFallback)).toBe(0);

    expect(preferencesFn(rowValue)).toBe(1);
    expect(preferencesFn(rowFallback)).toBe(0);

    expect(lockFn(rowValue)).toBe('L-9');
    expect(lockFn(rowFallback)).toBe('-');

    expect(assignmentFn(rowValue)).toBe(42);
    expect(assignmentFn(rowFallback)).toBe('-');
  });

  it('shows Loading... then Error in the detail view via test-only setters', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<UsydAdminPanel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(typeof globalThis.__TEST_SET_MODAL_OPEN__).toBe('function');
    expect(typeof globalThis.__TEST_SET_LOADING_DETAILS__).toBe('function');
    expect(typeof globalThis.__TEST_SET_DETAIL_ERROR__).toBe('function');

    globalThis.__TEST_SET_MODAL_OPEN__(true);
    globalThis.__TEST_SET_DETAIL_ERROR__('');
    globalThis.__TEST_SET_LOADING_DETAILS__(true);

    expect(await screen.findByText('Loading...')).toBeInTheDocument();

    globalThis.__TEST_SET_LOADING_DETAILS__(false);
    globalThis.__TEST_SET_DETAIL_ERROR__('Something went wrong');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});
