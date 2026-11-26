import { sha256 } from './sha256';
import { addDays, addDaysTo, uid } from './utils';

export const VERSION = 4;
export const hashPw = (pw) => sha256('es$' + pw);

export const CATEGORIES = [
  'Technology',
  'Healthcare',
  'Sustainability',
  'Manufacturing',
  'Food & Beverage',
  'Education',
  'Finance',
  'Automotive',
];
export const SESSION_TYPES = ['Keynote', 'Workshop', 'Panel', 'Talk', 'Networking'];
export const ROOMS = ['Main Stage', 'Workshop Room A', 'Innovation Lab', 'Panel Hall', 'Networking Lounge'];


function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROW_CFG = {
  0: { size: 'L', price: 4800, zone: 'Zone 1 · Premier' },
  1: { size: 'L', price: 3600, zone: 'Zone 1 · Premier' },
  2: { size: 'M', price: 2600, zone: 'Zone 2 · Standard' },
  3: { size: 'M', price: 2400, zone: 'Zone 2 · Standard' },
  4: { size: 'S', price: 1400, zone: 'Zone 3 · Startup' },
};

/** Generates the booth grid for an expo. */
export function genBooths(expoId, rows = 5, cols = 8) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cfg = ROW_CFG[Math.min(r, 4)];
      out.push({
        id: `b_${expoId}_${String.fromCharCode(65 + r)}${c + 1}`,
        expoId,
        label: `${String.fromCharCode(65 + r)}${c + 1}`,
        row: r,
        col: c,
        size: cfg.size,
        price: cfg.price,
        zone: cfg.zone,
        status: 'available',
        exhibitorId: null,
        appId: null,
        visits: 0,
        showcase: null,
      });
    }
  }
  return out;
}

const EXHIBITORS = [
  ['u_ex1', 'Zaid Malik', 'exhibitor@demo.com', 'NovaByte Systems', 'Technology', 'Cloud-native software for modern teams', ['Cloud ERP', 'AI Chatbots', 'DevOps Tooling'], 12],
  ['u_ex2', 'Hira Siddiqui', 'hira@helio.example', 'Helio Solar', 'Sustainability', 'Clean energy for homes and factories', ['Rooftop Solar', 'Battery Storage', 'Energy Audits'], 42],
  ['u_ex3', 'Dr. Imran Qureshi', 'imran@medicore.example', 'MediCore Labs', 'Healthcare', 'Diagnostics you can trust, results in minutes', ['Rapid Diagnostics', 'Lab Automation', 'Telehealth Kits'], 170],
  ['u_ex4', 'Nida Farooq', 'nida@fresco.example', 'Fresco Foods', 'Food & Beverage', 'Farm-to-shelf produce and ready meals', ['Organic Produce', 'Cold-chain Logistics', 'Ready Meals'], 120],
  ['u_ex5', 'Kamran Butt', 'kamran@torqueworks.example', 'TorqueWorks Motors', 'Automotive', 'Performance parts and EV conversions', ['EV Conversion Kits', 'Performance Parts', 'Fleet Servicing'], 215],
  ['u_ex6', 'Maryam Javed', 'maryam@learnloop.example', 'LearnLoop Academy', 'Education', 'Skills-first learning platform', ['Online Courses', 'Corporate Training', 'Certification'], 262],
  ['u_ex7', 'Usman Tariq', 'usman@payarc.example', 'PayArc Fintech', 'Finance', 'Payments infrastructure for emerging markets', ['Payment Gateway', 'POS Terminals', 'Fraud Detection'], 195],
  ['u_ex8', 'Faisal Rehman', 'faisal@steelforge.example', 'SteelForge Industries', 'Manufacturing', 'Precision fabrication at scale', ['CNC Machining', 'Sheet Metal', 'Industrial Robotics'], 28],
  ['u_ex9', 'Sana Iqbal', 'sana@aquapure.example', 'AquaPure Tech', 'Sustainability', 'Water treatment that pays for itself', ['Filtration Plants', 'Smart Water Meters', 'Desalination'], 190],
  ['u_ex10', 'Danish Rauf', 'danish@pixelforge.example', 'PixelForge Studio', 'Technology', 'Games, XR and interactive experiences', ['XR Experiences', 'Game Dev', 'Motion Graphics'], 300],
  ['u_ex11', 'Dr. Rabia Anwar', 'rabia@carenest.example', 'CareNest Health', 'Healthcare', 'Home care and elder-care technology', ['Remote Monitoring', 'Home Nursing', 'Wellness Apps'], 150],
  ['u_ex12', 'Adnan Shah', 'adnan@voltdrive.example', 'VoltDrive EV', 'Automotive', 'Electric two- and three-wheelers', ['E-Bikes', 'Charging Hubs', 'Battery Swapping'], 85],
];

const ATTENDEES = [
  ['u_at1', 'Sara Ali', 'attendee@demo.com'],
  ['u_at2', 'Omar Farooqui', 'omar@example.com'],
  ['u_at3', 'Zainab Hussain', 'zainab@example.com'],
  ['u_at4', 'Hamza Raza', 'hamza@example.com'],
  ['u_at5', 'Mehwish Noor', 'mehwish@example.com'],
  ['u_at6', 'Talha Mirza', 'talha@example.com'],
  ['u_at7', 'Iqra Saleem', 'iqra@example.com'],
  ['u_at8', 'Bilal Chaudhry', 'bilal.c@example.com'],
];

export function buildSeed() {
  const R = rng(20260);
  const nowIso = new Date().toISOString();
  const ago = (mins) => new Date(Date.now() - mins * 60000).toISOString();

  /* ---------- Users ---------- */
  const consent = { directory: true, analytics: true, marketing: false };
  const users = [
    {
      id: 'u_admin', name: 'Ayesha Khan', email: 'admin@eventsphere.com', passwordHash: hashPw('admin123'),
      role: 'admin', phone: '+92 300 1112233', status: 'active', createdAt: ago(60 * 24 * 200), consent,
      bio: 'Lead organizer at EventSphere Management.',
    },
    {
      id: 'u_org2', name: 'Bilal Ahmed', email: 'bilal@eventsphere.com', passwordHash: hashPw('admin123'),
      role: 'admin', phone: '+92 321 5557788', status: 'active', createdAt: ago(60 * 24 * 120), consent,
      bio: 'Operations & logistics.',
    },
    ...EXHIBITORS.map(([id, name, email, company, category, tagline, products, hue], i) => ({
      id, name, email, passwordHash: hashPw('demo123'), role: 'exhibitor',
      phone: `+92 3${10 + i} ${1000000 + i * 91357}`.slice(0, 16), status: 'active',
      createdAt: ago(60 * 24 * (150 - i * 9)), consent,
      company, category, tagline, hue, products,
      description: `${company} helps businesses and communities with ${products.slice(0, 2).join(' and ').toLowerCase()}. ${tagline}. Visit our booth for live demos, exclusive launch offers and partnership opportunities.`,
      website: `https://www.${company.toLowerCase().replace(/[^a-z]/g, '')}.example`,
      social: { linkedin: `linkedin.com/company/${company.toLowerCase().replace(/[^a-z]/g, '')}`, twitter: '' },
      logo: null,
      staff: [
        { id: uid('st'), name, role: 'Head of Partnerships', email },
        { id: uid('st'), name: 'Booth Lead', role: 'Sales Engineer', email: `booth@${company.toLowerCase().replace(/[^a-z]/g, '')}.example` },
      ],
    })),
    ...ATTENDEES.map(([id, name, email], i) => ({
      id, name, email, passwordHash: hashPw('demo123'), role: 'attendee', phone: `+92 34${i} 5550${100 + i}`,
      status: 'active', createdAt: ago(60 * 24 * (60 - i * 5)), consent,
      interests: i === 0 ? ['Technology', 'Sustainability'] : [CATEGORIES[i % CATEGORIES.length]],
      bio: '',
    })),
  ];

  /* ---------- Expos ---------- */
  const D = (n) => addDays(n);
  const expos = [
    {
      id: 'e1', title: 'TechNova Expo 2026', theme: 'AI, Cloud & the Next Decade of Software', category: 'Technology', hue: 12,
      status: 'live', startDate: D(-1), endDate: D(1), location: 'Karachi Expo Centre, Hall 3', city: 'Karachi',
      description: 'Three days of product launches, live demos and deep-dive sessions with the people building the future of software. Meet 40+ exhibitors, join hands-on workshops and network with 8,000 attendees.',
      capacity: 8000, ticketPrice: 25, tags: ['AI', 'Cloud', 'Startups', 'DevOps'], layout: { rows: 5, cols: 8 }, organizerId: 'u_admin',
    },
    {
      id: 'e2', title: 'GreenFuture Sustainability Summit', theme: 'Powering Tomorrow, Responsibly', category: 'Sustainability', hue: 160,
      status: 'upcoming', startDate: D(21), endDate: D(23), location: 'Lahore Expo Centre, Atrium', city: 'Lahore',
      description: 'Solar, storage, water and circular economy: the summit where policy-makers, investors and innovators discuss what actually scales. Includes a live product showcase and investor speed-dating.',
      capacity: 5000, ticketPrice: 20, tags: ['Solar', 'Water', 'Policy', 'Circular'], layout: { rows: 5, cols: 8 }, organizerId: 'u_admin',
    },
    {
      id: 'e3', title: 'MedExpo Health & Pharma', theme: 'Care Without Boundaries', category: 'Healthcare', hue: 195,
      status: 'upcoming', startDate: D(58), endDate: D(60), location: 'Islamabad Convention Complex', city: 'Islamabad',
      description: 'Diagnostics, digital health and pharmaceutical supply chain under one roof. Clinical workshops, regulatory briefings and a hospital procurement forum.',
      capacity: 6000, ticketPrice: 30, tags: ['Pharma', 'Digital Health', 'Diagnostics'], layout: { rows: 5, cols: 8 }, organizerId: 'u_org2',
    },
    {
      id: 'e4', title: 'FoodieFest International Trade Show', theme: 'Taste the World, Trade the Future', category: 'Food & Beverage', hue: 28,
      status: 'upcoming', startDate: D(95), endDate: D(97), location: 'Karachi Expo Centre, Hall 1', city: 'Karachi',
      description: 'South Asia’s largest food & beverage trade show: sourcing, packaging, cold-chain, and a chef-led live kitchen stage.',
      capacity: 7000, ticketPrice: 15, tags: ['Sourcing', 'Packaging', 'Live Kitchen'], layout: { rows: 5, cols: 8 }, organizerId: 'u_org2',
    },
    {
      id: 'e5', title: 'AutoWorld Motor Expo 2026', theme: 'Electrify Everything', category: 'Automotive', hue: 250,
      status: 'completed', startDate: D(-52), endDate: D(-50), location: 'Lahore Expo Centre, Hall 2', city: 'Lahore',
      description: 'EV launches, aftermarket innovation and a test-drive track. A record 12,000 visitors attended across three days.',
      capacity: 9000, ticketPrice: 18, tags: ['EV', 'Aftermarket', 'Test Drive'], layout: { rows: 5, cols: 8 }, organizerId: 'u_admin',
    },
    {
      id: 'e6', title: 'EduConnect Careers Fair', theme: 'Skills for the Next Workforce', category: 'Education', hue: 330,
      status: 'draft', startDate: D(140), endDate: D(141), location: 'Islamabad Convention Complex', city: 'Islamabad',
      description: 'A careers and skills fair connecting universities, bootcamps and employers. (Draft — not yet public.)',
      capacity: 3000, ticketPrice: 5, tags: ['Careers', 'Skills'], layout: { rows: 5, cols: 8 }, organizerId: 'u_admin',
    },
  ];

  // daily attendance for analytics
  expos.forEach((e) => {
    const days = e.status === 'live' ? 2 : e.status === 'completed' ? 3 : 0;
    e.daily = Array.from({ length: days }, (_, i) => ({
      day: `Day ${i + 1}`,
      visitors: Math.round(e.capacity * (0.28 + R() * 0.18) * (i === 1 ? 1.1 : 1)),
      registrations: Math.round(e.capacity * (0.08 + R() * 0.05)),
    }));
  });
  // Hourly series for the live expo
  const hourly = [9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => ({
    hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`,
    visitors: Math.round(180 + R() * 520 + (h > 10 && h < 15 ? 420 : 0)),
  }));
  expos.find((e) => e.id === 'e1').hourly = hourly;

  /* ---------- Booths ---------- */
  let booths = [];
  expos.filter((e) => e.status !== 'draft').forEach((e) => {
    const bs = genBooths(e.id, 5, 8);
    bs.forEach((b) => {
      if (e.status === 'live' || e.status === 'completed') b.visits = Math.round(40 + R() * 420);
      if (['C4', 'C5'].includes(b.label)) {
        b.status = 'blocked';
        b.note = 'Service column / utilities';
      }
    });
    booths = booths.concat(bs);
  });
  const booth = (eid, label) => booths.find((b) => b.expoId === eid && b.label === label);

  /* ---------- Applications ---------- */
  const applications = [];
  const exById = (id) => users.find((u) => u.id === id);
  const addApp = (eid, exId, status, label, daysAgo = 10, extra = {}) => {
    const ex = exById(exId);
    const app = {
      id: uid('app'), expoId: eid, exhibitorId: exId, company: ex.company, category: ex.category,
      products: ex.products.join(', '), contactName: ex.name, contactEmail: ex.email, phone: ex.phone,
      boothSize: ['S', 'M', 'L'][Math.floor(R() * 3)], message: 'We would like to showcase our latest products and meet distributors.',
      documents: [
        { name: 'Business-Registration.pdf', size: 482000 },
        { name: 'Company-Profile.pdf', size: 1240000 },
      ],
      status, note: status === 'rejected' ? 'Category oversubscribed for this edition. Please apply to the next expo.' : '',
      boothId: null, createdAt: ago(60 * 24 * daysAgo), decidedAt: status === 'pending' ? null : ago(60 * 24 * (daysAgo - 2)), ...extra,
    };
    if (label && (status === 'approved')) {
      const b = booth(eid, label);
      if (b) {
        b.status = 'booked';
        b.exhibitorId = exId;
        b.appId = app.id;
        app.boothId = b.id;
        b.showcase = {
          tagline: ex.tagline,
          products: ex.products.slice(),
          staff: ex.staff.map((s) => ({ ...s })),
          offer: R() > 0.5 ? 'Show-special: 15% off for visitors who book a demo.' : '',
          hours: '09:00 – 18:00',
        };
      }
    }
    applications.push(app);
    return app;
  };
  // E1 (live)
  addApp('e1', 'u_ex1', 'approved', 'A2', 30);
  addApp('e1', 'u_ex10', 'approved', 'A3', 29);
  addApp('e1', 'u_ex7', 'approved', 'A1', 28);
  addApp('e1', 'u_ex6', 'approved', 'B2', 27);
  addApp('e1', 'u_ex8', 'approved', 'B1', 26);
  addApp('e1', 'u_ex3', 'approved', 'B4', 25);
  addApp('e1', 'u_ex9', 'approved', 'C1', 24);
  addApp('e1', 'u_ex4', 'approved', 'D3', 24);
  addApp('e1', 'u_ex2', 'approved', 'E2', 23);
  addApp('e1', 'u_ex11', 'rejected', null, 20);
  // E2
  addApp('e2', 'u_ex1', 'approved', null, 6);
  addApp('e2', 'u_ex2', 'approved', 'A4', 12);
  addApp('e2', 'u_ex9', 'approved', 'A5', 11);
  addApp('e2', 'u_ex8', 'pending', null, 3);
  addApp('e2', 'u_ex7', 'pending', null, 2);
  addApp('e2', 'u_ex12', 'pending', null, 1);
  // E3
  addApp('e3', 'u_ex1', 'pending', null, 2);
  addApp('e3', 'u_ex3', 'approved', 'A2', 14);
  addApp('e3', 'u_ex11', 'approved', 'B3', 10);
  addApp('e3', 'u_ex6', 'pending', null, 1);
  // E4
  addApp('e4', 'u_ex4', 'approved', 'A1', 9);
  addApp('e4', 'u_ex2', 'pending', null, 1);
  // E5 (completed)
  addApp('e5', 'u_ex5', 'approved', 'A2', 90);
  addApp('e5', 'u_ex12', 'approved', 'A3', 88);
  addApp('e5', 'u_ex8', 'approved', 'B2', 85);

  /* ---------- Sessions ---------- */
  const sessions = [];
  const S = (eid, startDate, list) =>
    list.forEach(([day, st, en, type, title, speaker, role, room, interest, desc]) =>
      sessions.push({
        id: uid('s'), expoId: eid, date: addDaysTo(startDate, day), start: st, end: en, type, title,
        topic: title.split(':')[0], speaker, speakerRole: role, room, capacity: type === 'Workshop' ? 60 : 300,
        interest, description: desc || 'Join us for an engaging session with Q&A and networking.',
      }),
    );
  const e = (id) => expos.find((x) => x.id === id);
  S('e1', e('e1').startDate, [
    [0, '10:00', '11:00', 'Keynote', 'The Next Decade of Software: AI-native Everything', 'Dr. Salman Raza', 'CTO, FutureStack', 'Main Stage', 240, 'A look at how AI-native architectures change product, team and cost structures.'],
    [0, '11:30', '12:30', 'Workshop', 'Hands-on: Build a RAG Chatbot in 60 Minutes', 'Anum Siddiqui', 'ML Engineer, NovaByte', 'Workshop Room A', 180, 'Bring a laptop. We will ship a working retrieval-augmented chatbot.'],
    [0, '14:00', '15:00', 'Panel', 'Cloud Costs: Stop the Bleeding', 'Panel of 4 CTOs', 'Moderated by Ayesha Khan', 'Panel Hall', 130],
    [1, '09:30', '10:30', 'Talk', 'Zero-downtime Deployments at Scale', 'Faraz Haider', 'SRE Lead, PayArc', 'Innovation Lab', 150],
    [1, '11:00', '12:30', 'Workshop', 'Design Systems that Developers Love', 'Mahnoor Tariq', 'Principal Designer, PixelForge', 'Workshop Room A', 170],
    [1, '14:00', '15:30', 'Keynote', 'Building a Startup in Emerging Markets', 'Haris Chaudhry', 'Founder, Cloudline', 'Main Stage', 220],
    [1, '17:00', '18:30', 'Networking', 'Founders & Investors Mixer', 'Hosted by EventSphere', 'Open to all attendees', 'Networking Lounge', 120],
    [2, '10:00', '11:00', 'Talk', 'Cyber-security in the Age of AI', 'Noman Ghani', 'CISO, BankOne', 'Innovation Lab', 160],
    [2, '12:00', '13:00', 'Panel', 'Women in Tech: Leading from the Front', 'Panel of 5 leaders', 'Moderated by Hira Siddiqui', 'Main Stage', 200],
  ]);
  S('e2', e('e2').startDate, [
    [0, '10:00', '11:00', 'Keynote', 'Solar at Scale: Lessons from 1 GW', 'Eng. Waqar Ahmed', 'CEO, Helio Solar', 'Main Stage', 210],
    [0, '11:30', '13:00', 'Workshop', 'Financing Your First Rooftop Solar Fleet', 'Rida Baig', 'Climate Finance Specialist', 'Workshop Room A', 140],
    [0, '15:00', '16:00', 'Panel', 'Water Security: Policy Meets Technology', 'Panel of 4 experts', 'Moderated by Sana Iqbal', 'Panel Hall', 120],
    [1, '10:00', '11:00', 'Talk', 'Battery Storage: What the Numbers Say', 'Dr. Tahir Mehmood', 'Energy Researcher, NUST', 'Innovation Lab', 130],
    [1, '14:00', '15:30', 'Networking', 'Investor Speed-dating', 'Hosted by EventSphere', 'Pre-registration advised', 'Networking Lounge', 150],
    [2, '10:30', '11:30', 'Keynote', 'Circular Economy in Practice', 'Amna Zafar', 'Director, ReLoop', 'Main Stage', 160],
  ]);
  S('e3', e('e3').startDate, [
    [0, '10:00', '11:00', 'Keynote', 'The Future of Point-of-care Diagnostics', 'Dr. Imran Qureshi', 'Founder, MediCore Labs', 'Main Stage', 190],
    [0, '12:00', '13:30', 'Workshop', 'Telehealth Implementation Playbook', 'Dr. Rabia Anwar', 'CEO, CareNest Health', 'Workshop Room A', 140],
    [1, '10:00', '11:30', 'Panel', 'Pharma Supply Chain Resilience', 'Panel of 5 experts', 'Moderated by Bilal Ahmed', 'Panel Hall', 135],
    [2, '11:00', '12:00', 'Talk', 'Regulatory Update: DRAP & Digital Health', 'Sadia Rauf', 'Regulatory Counsel', 'Innovation Lab', 110],
  ]);
  S('e4', e('e4').startDate, [
    [0, '11:00', '12:00', 'Keynote', 'Feeding 250 Million: Food Systems of the Future', 'Chef Zubair Ali', 'Culinary Director', 'Main Stage', 170],
    [1, '13:00', '14:30', 'Workshop', 'Cold-chain Logistics for SMEs', 'Nida Farooq', 'COO, Fresco Foods', 'Workshop Room A', 100],
  ]);
  S('e5', e('e5').startDate, [
    [0, '10:00', '11:00', 'Keynote', 'Electrify Everything', 'Kamran Butt', 'CEO, TorqueWorks', 'Main Stage', 260],
    [1, '12:00', '13:00', 'Panel', 'EV Charging Infrastructure', 'Panel of 4 experts', 'Moderated by Adnan Shah', 'Panel Hall', 190],
  ]);

  /* ---------- Registrations ---------- */
  const registrations = [];
  const sessionRegs = [];
  const reg = (eid, uidd, ticket = 'Standard', daysAgo = 5) =>
    registrations.push({ id: uid('reg'), expoId: eid, userId: uidd, ticket, createdAt: ago(60 * 24 * daysAgo) });
  const sr = (sid, uidd, type) => sessionRegs.push({ id: uid('sr'), sessionId: sid, userId: uidd, type, createdAt: nowIso });
  const sOf = (eid) => sessions.filter((s) => s.expoId === eid);

  reg('e1', 'u_at1', 'Premium', 12);
  reg('e2', 'u_at1', 'Standard', 4);
  ATTENDEES.slice(1).forEach(([id], i) => {
    reg('e1', id, ['Standard', 'Premium', 'VIP'][i % 3], 10 - i);
    if (i % 2 === 0) reg('e2', id, 'Standard', 3);
    if (i % 3 === 0) reg('e3', id, 'Standard', 2);
    sOf('e1').forEach((s, k) => {
      if (R() > 0.45) sr(s.id, id, R() > 0.5 ? 'register' : 'bookmark');
      if (k === 0 && i < 2) return;
    });
  });
  // demo attendee: tomorrow's sessions
  const e1s = sOf('e1');
  sr(e1s[0].id, 'u_at1', 'register');
  sr(e1s[1].id, 'u_at1', 'bookmark');
  sr(e1s[5].id, 'u_at1', 'register');
  sr(e1s[6].id, 'u_at1', 'bookmark');
  sr(sOf('e2')[0].id, 'u_at1', 'bookmark');

  /* ---------- Messages ---------- */
  const messages = [];
  const msg = (from, to, text, minsAgo, extra = {}) =>
    messages.push({ id: uid('m'), from, to, text, kind: 'text', createdAt: ago(minsAgo), read: minsAgo > 300, ...extra });
  msg('u_ex1', 'u_admin', 'Hi, could we get an extra power outlet at booth A2 for our demo screens?', 1500);
  msg('u_admin', 'u_ex1', 'Hi Zaid! Sure — I have noted a 2-socket upgrade for A2. It will be ready before doors open tomorrow.', 1440);
  msg('u_ex1', 'u_admin', 'Perfect, thank you!', 1430);
  msg('u_ex2', 'u_ex1', 'Hi Zaid, Hira from Helio Solar here (E2, next to you at the GreenFuture floor). Want to cross-promote?', 600);
  msg('u_ex1', 'u_ex2', 'Hi Hira! Love it. Let’s exchange booth flyers and share each other’s demo schedule.', 580);
  msg('u_ex10', 'u_ex1', 'Neighbour at A3 here — happy to lend you an HDMI splitter if you need one!', 240, { read: false });
  msg('u_at1', 'u_ex1', 'Hello! Is there a trial available for your Cloud ERP?', 200);
  msg('u_ex1', 'u_at1', 'Absolutely — drop by booth A2 or book an appointment and we’ll set you up with a 30-day sandbox.', 190);
  msg('u_admin', 'u_at1', 'Welcome to TechNova Expo! Your Premium pass gives access to the VIP lounge on Level 2.', 100, { read: false });

  /* ---------- Notifications ---------- */
  const notifications = [];
  const note = (userId, title, text, type, minsAgo, link = null, read = false) =>
    notifications.push({ id: uid('n'), userId, title, text, type, link, read, createdAt: ago(minsAgo) });
  note('u_ex1', 'Application approved', 'Your application for GreenFuture Sustainability Summit was approved. Pick your booth now.', 'success', 300, '/dashboard/booth');
  note('u_ex1', 'New message', 'Danish Rauf (PixelForge Studio) sent you a message.', 'message', 240, '/dashboard/messages');
  note('u_ex1', 'Booth confirmed', 'Booth A2 at TechNova Expo 2026 is confirmed.', 'success', 60 * 24 * 20, '/dashboard/showcase', true);
  note('u_at1', 'Session starting soon', 'The Next Decade of Software: AI-native Everything starts tomorrow at 10:00 AM.', 'reminder', 120, '/dashboard/agenda');
  note('u_at1', 'Schedule update', 'Room change: “Hands-on: Build a RAG Chatbot” has moved to Workshop Room A.', 'info', 60 * 6, '/dashboard/agenda');
  note('u_at1', 'Registration confirmed', 'You are registered for TechNova Expo 2026 (Premium).', 'success', 60 * 24 * 12, '/dashboard/expos', true);
  note('u_admin', 'New exhibitor application', 'SteelForge Industries applied for GreenFuture Sustainability Summit.', 'info', 4320, '/dashboard/applications');
  note('u_admin', 'New feedback', 'A user reported an issue with ticket downloads.', 'warning', 500, '/dashboard/feedback');

  /* ---------- Feedback ---------- */
  const feedback = [
    { id: uid('fb'), userId: 'u_at2', name: 'Omar Farooqui', email: 'omar@example.com', type: 'suggestion', subject: 'Add a mobile wallet pass', message: 'It would be great to add my expo ticket to Apple/Google Wallet.', rating: 4, status: 'open', createdAt: ago(60 * 30), note: '' },
    { id: uid('fb'), userId: 'u_at3', name: 'Zainab Hussain', email: 'zainab@example.com', type: 'issue', subject: 'Ticket download not working on Safari', message: 'The download button does nothing on iOS Safari 17.', rating: 2, status: 'in_progress', createdAt: ago(60 * 20), note: 'Reproduced — fix in progress.' },
    { id: uid('fb'), userId: 'u_ex2', name: 'Hira Siddiqui', email: 'hira@helio.example', type: 'suggestion', subject: 'Booth lead scanning', message: 'Please add QR-based lead capture for exhibitors.', rating: 5, status: 'open', createdAt: ago(60 * 10), note: '' },
    { id: uid('fb'), userId: 'u_at5', name: 'Mehwish Noor', email: 'mehwish@example.com', type: 'question', subject: 'Are workshops recorded?', message: 'Will the workshop sessions be available as recordings afterwards?', rating: 4, status: 'resolved', createdAt: ago(60 * 48), note: 'Answered by email.' },
    { id: uid('fb'), userId: 'u_at6', name: 'Talha Mirza', email: 'talha@example.com', type: 'suggestion', subject: 'Love the floor plan', message: 'The interactive floor plan made finding exhibitors so easy. Thanks!', rating: 5, status: 'resolved', createdAt: ago(60 * 72), note: '' },
    { id: uid('fb'), userId: 'u_ex9', name: 'Sana Iqbal', email: 'sana@aquapure.example', type: 'issue', subject: 'Logo upload cropped', message: 'My logo gets cropped in the exhibitor directory card.', rating: 3, status: 'open', createdAt: ago(60 * 6), note: '' },
  ];

  /* ---------- Activity feed ---------- */
  const activity = [
    { id: uid('a'), text: 'Visitor checked in at Hall 3 entrance', createdAt: ago(2) },
    { id: uid('a'), text: 'Booth A2 · NovaByte Systems received a demo request', createdAt: ago(5) },
    { id: uid('a'), text: 'Session “Hands-on: Build a RAG Chatbot” is 92% full', createdAt: ago(11) },
    { id: uid('a'), text: 'Sara Ali registered for TechNova Expo (Premium)', createdAt: ago(35) },
    { id: uid('a'), text: 'GreenFuture: 3 new booth reservations today', createdAt: ago(60) },
  ];

  return {
    version: VERSION, users, expos, booths, applications, sessions, registrations, sessionRegs,
    messages, notifications, feedback, activity, resetTokens: [],
  };
}
