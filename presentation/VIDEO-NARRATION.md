# EventSphere — Submission video narration

1. Meet EventSphere, a MERN based expo management platform. It connects organizers, exhibitors and attendees through one workflow, from publishing an expo to managing booths, tickets and event engagement.

2. EventSphere has three main roles. Administrators manage the event and its operations. Exhibitors apply for booth space and manage their company presence. Attendees discover events, register and use their passes. Protected APIs enforce role permissions.

3. An organizer creates and publishes an Expo with its venue, schedule, opening hours and timezone. They review exhibitor applications, allocate booths, manage sessions and announcements, check in attendees, and review event analytics.

4. The exhibitor completes a company profile, browses published expos and submits an application. An organizer reviews it. Only after approval can the exhibitor reserve an available booth for that Expo. The application page shows its status and assignment.

5. The booth floor plan makes inventory easy to explain. Available booths can be selected. Reserved means an approved exhibitor has chosen a booth and is waiting for organizer confirmation. Confirmed means the organizer has confirmed it. Unavailable spaces cannot be booked.

6. Attendees browse published expos and register for a ticket tier. Standard registration is free. Premium and VIP use a simulated demo payment, not a real gateway charge. The attendee can view a QR pass, verify their registration and be checked in by an organizer.

7. Communication tools support the event. Users can exchange persistent messages with delivery and read receipts. Organizers publish audience-specific announcements. Attendees can submit feedback, and the chatbot provides role-aware guidance with retry support.

8. Analytics summarize real recorded activity. Admin reports include Expo registrations, ticket breakdowns and booth traffic. Exhibitors see aggregate analytics for their own assigned booths. Booth visits are recorded through a verified attendee check-in workflow, not estimated as automatic footfall.

9. EventSphere combines React, Node and Express, and MongoDB. JWT protects account access, while Socket.IO supports live updates. Nodemailer supports transactional email when configured. This is an illustrative feature overview; final live acceptance still requires testing with the project’s own database, accounts and service configuration.
