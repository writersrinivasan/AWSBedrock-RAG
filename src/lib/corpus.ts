// Industrial scenario: "Helix Wind Energy" (fictional) operates 420 HX-3000 wind turbines.
// Field technicians need instant, cited answers from manuals, SOPs, alarm guides and incident reports.
// These documents play the role of the files you would upload to Amazon S3 for a Bedrock Knowledge Base.

export type KbDocument = {
  id: string;
  title: string;
  fileName: string;
  sizeKb: number;
  metadata: Record<string, string>;
  text: string;
};

export const BUCKET = "helix-wind-kb-docs-123456789012";

export const DOCUMENTS: KbDocument[] = [
  {
    id: "doc-maint",
    title: "HX-3000 Turbine Maintenance Manual (Rev. 7)",
    fileName: "manuals/HX-3000-maintenance-manual-rev7.pdf",
    sizeKb: 2480,
    metadata: { doc_type: "manual", department: "maintenance", turbine_model: "HX-3000", revision: "7" },
    text: `The HX-3000 is a 3.2 MW onshore wind turbine with a three-stage planetary gearbox, a doubly-fed induction generator and an electric pitch system. Rotor diameter is 136 metres and hub height is 112 metres.

Gearbox oil service: the gearbox holds 680 litres of ISO VG 320 synthetic oil. Take an oil sample every 6 months and send it for particle count and water content analysis. Replace the oil every 36 months or immediately if water content exceeds 500 ppm or the ISO 4406 cleanliness code is worse than 18/16/13. Replace the inline gearbox oil filter every 12 months or when the differential pressure indicator exceeds 2.5 bar.

Main bearing lubrication: the main shaft bearing is greased automatically by the central lubrication unit. The grease reservoir must be refilled with 8 kg of NLGI 2 lithium-complex grease every 6 months. A low-grease warning appears on the SCADA panel when the reservoir drops below 15 percent.

Bolt torque specifications: blade root bolts M36 must be torqued to 2,850 Nm using a calibrated hydraulic torque wrench. Tower flange bolts M48 must be torqued to 4,200 Nm. Torque checks are required 500 operating hours after commissioning and then every 12 months. Always torque in a star pattern in three passes: 30 percent, 70 percent and 100 percent of the final value.

Vibration monitoring: the condition monitoring system (CMS) measures vibration velocity in mm/s RMS on the main bearing, gearbox and generator. For the generator bearing, 0 to 4.5 mm/s is normal, 4.5 to 7.1 mm/s is alert, and above 7.1 mm/s is alarm and the turbine must be stopped for inspection within 24 hours. For the gearbox high-speed shaft, the alarm threshold is 6.3 mm/s.

Annual service checklist: inspect blade leading edges for erosion, test the emergency stop chain, verify yaw brake pad thickness (replace below 4 mm), check pitch battery capacity (replace if below 80 percent of rated capacity), clean nacelle cooling filters, and verify the lightning protection system resistance is below 10 ohms.`,
  },
  {
    id: "doc-loto",
    title: "SOP-114 Lockout/Tagout and Working at Height",
    fileName: "safety/SOP-114-lockout-tagout-working-at-height.pdf",
    sizeKb: 640,
    metadata: { doc_type: "sop", department: "hse", turbine_model: "ALL", revision: "4" },
    text: `Purpose: SOP-114 defines the mandatory lockout/tagout (LOTO) and working-at-height procedure for every Helix Wind Energy technician and contractor. No work may begin inside the nacelle, hub or tower until every step is complete. Bypassing, defeating or disabling any safety interlock, rotor lock or brake is strictly prohibited and is a dismissible offence.

Personal protective equipment: a full-body harness with twin-leg energy-absorbing lanyard, helmet with chin strap, arc-rated clothing (minimum 8 cal/cm2) when working on energised panels, safety boots and gloves. Harnesses must be inspected before every climb and certified every 12 months.

Weather limits: climbing is not permitted when the 10-minute average wind speed exceeds 15 m/s. Work in the hub is not permitted above 12 m/s. All work must stop if lightning is detected within 10 km, and technicians must not re-enter the turbine until 30 minutes after the last strike.

Lockout sequence: 1) Notify the remote operations centre and record the work order number. 2) Put the turbine in service mode from the ground controller. 3) Pitch blades to the feathered position (90 degrees). 4) Apply the mechanical rotor brake and wait until the rotor is fully stopped. 5) Engage the rotor lock pin; never enter the hub without the rotor lock engaged. 6) Open and lock the main circuit breaker and the 690 V grid disconnect. 7) Apply a personal padlock and danger tag to each isolation point. 8) Verify zero energy with a calibrated voltage tester.

Two-person rule: climbing and hub entry always require a minimum of two trained technicians, and one must hold a valid GWO rescue certificate. A rescue kit must be present in the nacelle.

Removing the lockout: only the person who applied a padlock may remove it. Before removal, confirm all tools are removed, all personnel are clear of rotating parts, and notify the remote operations centre.`,
  },
  {
    id: "doc-alarms",
    title: "HX-3000 SCADA Alarm Code Reference",
    fileName: "manuals/HX-3000-scada-alarm-codes.pdf",
    sizeKb: 910,
    metadata: { doc_type: "manual", department: "operations", turbine_model: "HX-3000", revision: "12" },
    text: `This reference lists the most common SCADA alarm codes for the HX-3000 and the first-response actions for field technicians.

E-201 Gearbox oil temperature high: triggered when the gearbox oil sump temperature exceeds 80 degrees Celsius for more than 60 seconds. The turbine derates to 50 percent power. First response: check the oil cooler fan and the thermostatic bypass valve, clean the cooler radiator, and verify the oil level. If the temperature exceeds 90 degrees Celsius the turbine performs an automatic stop.

E-305 Pitch system fault: raised when one blade deviates more than 2 degrees from the commanded pitch angle or a pitch motor drive reports an error. First response: check the pitch battery voltage (nominal 216 V DC), inspect the slip ring, and read the pitch drive error log. A turbine with an active E-305 must not be restarted remotely.

E-412 Yaw misalignment: raised when the nacelle is misaligned with the wind direction by more than 15 degrees for 10 minutes. First response: inspect the wind vane and ultrasonic anemometer, check the yaw motors and yaw brake pressure (nominal 160 bar).

E-518 Generator bearing vibration high: raised when the generator drive-end bearing vibration exceeds 7.1 mm/s RMS. First response: stop the turbine, inspect the generator bearing grease condition and the generator-to-gearbox coupling alignment. Typical root causes are insufficient lubrication, coupling misalignment greater than 0.3 mm, or bearing wear. Escalate to the reliability engineering team with the CMS spectrum report.

E-620 Converter over-temperature: raised when the converter cabinet IGBT temperature exceeds 95 degrees Celsius. First response: check the converter cooling water pump and glycol level, and clean the cabinet air filters.`,
  },
  {
    id: "doc-incident",
    title: "Incident Report IR-2025-037: Generator Bearing Failure, Site Kestrel Ridge T-14",
    fileName: "incidents/IR-2025-037-kestrel-ridge-t14.pdf",
    sizeKb: 420,
    metadata: { doc_type: "incident_report", department: "reliability", turbine_model: "HX-3000", revision: "1" },
    text: `Summary: on 14 March 2025, turbine T-14 at the Kestrel Ridge wind farm stopped on alarm E-518 (generator bearing vibration high). The generator drive-end bearing had failed, causing 19 days of downtime and an estimated production loss of 410 MWh.

Timeline: the CMS recorded vibration rising from 3.8 mm/s to 6.9 mm/s over three weeks, which was within the alert band but no work order was raised. On the day of failure vibration reached 11.2 mm/s and the turbine stopped automatically.

Root cause: the automatic lubrication line to the generator bearing was blocked by hardened grease, so the bearing ran with insufficient lubrication for approximately 5 months. A secondary contributing factor was coupling misalignment of 0.45 mm, above the 0.3 mm limit.

Corrective actions: 1) Replace the generator drive-end bearing (part HX-GEN-BRG-DE) and realign the coupling with a laser alignment tool. 2) Flush and replace all lubrication lines on T-14. 3) Fleet-wide: inspect generator lubrication lines on all HX-3000 turbines within 60 days. 4) Change the CMS process so that any generator bearing vibration in the alert band (above 4.5 mm/s) for more than 7 days automatically creates a work order.

Lessons learned: alert-band vibration trends must be acted on before they reach alarm level. Lubrication line inspection has been added to the annual service checklist.`,
  },
  {
    id: "doc-parts",
    title: "Spare Parts Catalogue and Lead Times 2025",
    fileName: "supply-chain/spare-parts-catalogue-2025.xlsx",
    sizeKb: 350,
    metadata: { doc_type: "catalogue", department: "supply_chain", turbine_model: "HX-3000", revision: "2025.2" },
    text: `This catalogue lists critical spare parts for the HX-3000 fleet, warehouse stock and supplier lead times. Prices are internal transfer prices in USD.

HX-GEN-BRG-DE generator drive-end bearing: unit price 6,800 USD, central warehouse stock 6, lead time 4 weeks if out of stock. HX-GEN-BRG-NDE generator non-drive-end bearing: 5,900 USD, stock 4, lead time 4 weeks.

HX-GBX-FLT-01 gearbox inline oil filter element: 240 USD, stock 120, lead time 1 week. HX-GBX-OIL-320 ISO VG 320 synthetic gearbox oil, 208-litre drum: 2,150 USD, stock 30 drums, lead time 2 weeks. A full oil change requires 4 drums.

HX-PIT-BAT-216 pitch backup battery pack 216 V: 3,400 USD, stock 18, lead time 6 weeks. HX-PIT-MOT-02 pitch motor: 7,600 USD, stock 5, lead time 10 weeks.

HX-YAW-PAD-08 yaw brake pad set: 460 USD, stock 60, lead time 2 weeks. HX-GRS-NLGI2 lithium-complex grease, 18 kg pail: 310 USD, stock 75.

HX-GBX-ASSY complete gearbox assembly: 410,000 USD, stock 1, lead time 26 weeks. Ordering a complete gearbox requires approval from the VP of Operations. Emergency orders for parts with lead time above 4 weeks can be expedited for a 15 percent surcharge.`,
  },
  {
    id: "doc-warranty",
    title: "Service Agreement and Warranty Terms (Helix Wind x Grid Customers)",
    fileName: "contracts/service-agreement-warranty-terms.pdf",
    sizeKb: 780,
    metadata: { doc_type: "contract", department: "commercial", turbine_model: "ALL", revision: "3" },
    text: `Availability guarantee: Helix Wind Energy guarantees a time-based turbine availability of 97 percent per contract year for each wind farm under a full-service agreement. If availability falls below 97 percent, a liquidated damages payment of 0.5 percent of the annual service fee is due for each 0.1 percent shortfall.

Response times: for a turbine stopped by a critical alarm, a technician must be on site within 24 hours. For non-critical alarms the response time is 72 hours. Remote reset attempts must be made within 30 minutes of a stop, except for safety-related alarms such as E-305, which require an on-site inspection.

Warranty: major components (gearbox, generator, main bearing and blades) are covered for 5 years from commissioning. The warranty is void if the operator fails to follow the maintenance manual intervals, uses non-approved lubricants, or if a failure is caused by neglected condition monitoring alerts.

Exclusions: damage caused by lightning beyond IEC 61400-24 protection level I, grid faults outside the agreed grid code, force majeure and vandalism are excluded from both the availability guarantee and the warranty.

Reporting: Helix Wind Energy provides a monthly availability report and a quarterly reliability review. Incident reports for any downtime longer than 7 days must be shared with the customer within 10 business days.`,
  },
];

export const s3Uri = (doc: KbDocument) => `s3://${BUCKET}/${doc.fileName}`;
