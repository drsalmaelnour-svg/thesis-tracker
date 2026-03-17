export const EMAIL_TEMPLATES = {
  orcid_request: {
    label: 'ORCID Registration Request',
    subject: 'Action Required: Please Register Your ORCID ID',
    body: `Dear {{student_name}},

As part of your thesis program requirements, you are required to register for an ORCID (Open Researcher and Contributor ID) — a unique, persistent identifier for researchers.

Please complete your ORCID registration at https://orcid.org/register and confirm by clicking the link below:

{{response_link}}

If you have already registered, simply click the confirmation link and enter your ORCID in the notes.

Please complete this by {{due_date}}.

Best regards,
Thesis Coordination Office`,
  },

  proposal_defense_notice: {
    label: 'Proposal Defense Notice',
    subject: 'Upcoming: Thesis Proposal Defense',
    body: `Dear {{student_name}},

This is a reminder that your Thesis Proposal Defense is approaching.

Please ensure your proposal document is submitted to your supervisor at least two weeks prior to the defense date.

Once your defense has been successfully completed, please confirm via the link below:

{{response_link}}

Best regards,
Thesis Coordination Office`,
  },

  irb_approval_request: {
    label: 'IRB Approval Reminder',
    subject: 'Reminder: IRB Ethics Approval Required',
    body: `Dear {{student_name}},

Your IRB (Institutional Review Board) ethics approval is a required milestone for your thesis progress.

Please ensure you have submitted your ethics application and share any updates with your supervisor.

Once your IRB approval has been received, please confirm via the link below:

{{response_link}}

Best regards,
Thesis Coordination Office`,
  },

  progress_report: {
    label: 'Progress Report Due',
    subject: 'Action Required: Progress Report Submission',
    body: `Dear {{student_name}},

Your {{milestone}} is now due. Please submit your report to your supervisor and confirm submission below:

{{response_link}}

Best regards,
Thesis Coordination Office`,
  },

  defense_scheduling: {
    label: 'Defense Scheduling',
    subject: 'Action Required: Schedule Your Thesis Defense',
    body: `Dear {{student_name}},

It is time to schedule your thesis defense. Please coordinate with your supervisor and the graduate office to confirm a date and time.

Once a date has been confirmed, please update the system via the link below:

{{response_link}}

Best regards,
Thesis Coordination Office`,
  },

  thesis_submission: {
    label: 'Final Thesis Submission',
    subject: 'Congratulations — Final Thesis Submission',
    body: `Dear {{student_name}},

Congratulations on reaching the final stage of your thesis journey!

Please submit your corrected thesis to the graduate office and confirm submission below:

{{response_link}}

We wish you all the best.

Best regards,
Thesis Coordination Office`,
  },

  general_reminder: {
    label: 'General Reminder',
    subject: 'Thesis Progress Reminder',
    body: `Dear {{student_name}},

This is a friendly reminder regarding your thesis progress. Please check the milestone below and take the required action.

{{response_link}}

Best regards,
Thesis Coordination Office`,
  },
}

export const SUPERVISOR_TEMPLATES = {
  student_progress_update: {
    label: 'Student Progress Update',
    subject: 'Thesis Progress Update: {{student_name}}',
    body: `Dear {{supervisor_name}},

This is an update regarding your student {{student_name}}'s thesis progress.

Milestone: {{milestone}}
Status: {{status}}

Please log into the thesis coordination system for full details.

Best regards,
Thesis Coordination Office`,
  },
  review_request: {
    label: 'Review Request',
    subject: 'Review Required: {{student_name}} — {{milestone}}',
    body: `Dear {{supervisor_name}},

Your student {{student_name}} has submitted their {{milestone}} and it is awaiting your review.

Please review and provide feedback at your earliest convenience.

Best regards,
Thesis Coordination Office`,
  },
}
