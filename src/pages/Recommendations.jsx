import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react';

const platforms = [
  {
    name: 'Google Forms + Google Sheets',
    best_for: 'Immediate, low-cost daily reporting',
    description: 'Staff submit daily reports through a Google Form. Responses automatically feed into a Google Sheet for tracking, filtering, and analysis. Ideal for teams that need a quick and free solution.',
    pros: ['Free to use', 'Easy setup', 'Automatic data collection', 'Shareable reports', 'Works on any device'],
    cons: ['No real-time presence tracking', 'Manual analysis needed', 'Limited workflow automation'],
    cost: 'Free',
    link: 'https://workspace.google.com'
  },
  {
    name: 'Microsoft Teams + Shifts + Planner',
    best_for: 'Hybrid organizations needing online status, scheduling, meetings, and shift compliance',
    description: 'Microsoft Teams provides online presence tracking, video meetings, and team chat. Combined with Shifts for employee scheduling and Planner for task management, it creates a full hybrid workforce solution.',
    pros: ['Real-time online status', 'Shift scheduling', 'Integrated meetings and chat', 'Task management with Planner', 'Enterprise-grade security'],
    cons: ['Requires Microsoft 365 subscription', 'Complex admin setup', 'Learning curve for staff'],
    cost: 'From $6/user/month (Business Basic)',
    link: 'https://www.microsoft.com/en-us/microsoft-teams/'
  },
  {
    name: 'ClickUp',
    best_for: 'Task assignment, workflow tracking, productivity dashboards, time tracking, and project ownership',
    description: 'ClickUp is an all-in-one project management tool with time tracking, dashboards, workflow automation, and custom views. Excellent for teams that need granular task-level visibility.',
    pros: ['Comprehensive task management', 'Built-in time tracking', 'Custom dashboards', 'Workflow automation', 'Multiple view types (list, board, Gantt, calendar)'],
    cons: ['Can be overwhelming for small teams', 'Mobile app limitations', 'Steeper learning curve'],
    cost: 'Free plan available; Unlimited from $7/user/month',
    link: 'https://clickup.com'
  },
  {
    name: 'monday.com',
    best_for: 'Visual workflow tracking, team dashboards, project status, and management reporting',
    description: 'monday.com provides a colorful, visual workflow management platform with customizable boards, automations, and dashboards. Great for management teams who want at-a-glance status reporting.',
    pros: ['Visual and intuitive', 'Customizable boards', 'Built-in automations', 'Great dashboard reporting', 'Easy adoption'],
    cons: ['Pricing can scale quickly', 'Limited free plan', 'Less suitable for technical project management'],
    cost: 'From $9/seat/month (Basic)',
    link: 'https://monday.com'
  },
  {
    name: 'Slack + Workflow Builder',
    best_for: 'Check-ins, online status, communication, and lightweight workflow automation',
    description: 'Slack excels at team communication with real-time messaging, channels, and online presence indicators. The Workflow Builder enables automated check-ins, standup prompts, and lightweight task tracking.',
    pros: ['Real-time online status', 'Channel-based organization', 'Automated standup check-ins', 'Rich integration ecosystem', 'Easy to adopt'],
    cons: ['Not a full project management tool', 'Message history limits on free plan', 'Can become noisy with too many channels'],
    cost: 'Free plan available; Pro from $8.75/user/month',
    link: 'https://slack.com'
  }
];

export default function Recommendations() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      <Card className="gradient-primary text-primary-foreground">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-8 h-8 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold mb-2">Platform Recommendations for RazziPay</h2>
              <p className="opacity-90">
                The following platforms are recommended for hybrid organizations looking to enhance 
                workflow tracking, staff scheduling, and online presence monitoring. These can complement 
                the built-in RazziPay HR system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            Recommended Approach for RazziPay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm"><strong>Phase 1 (Now):</strong> Use the built-in RazziPay HR/Workflow tracker for staff records, daily reports, and compliance tracking. Set up Google Forms + Sheets as a backup reporting channel.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm"><strong>Phase 2 (Short-term):</strong> Integrate with Microsoft Teams or Slack for real-time presence tracking and team communication. This provides clock-in visibility and online status.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm"><strong>Phase 3 (Long-term):</strong> Add ClickUp or monday.com for advanced project management, time tracking, and detailed productivity analytics. Connect with RazziPay via API for centralized dashboard reporting.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {platforms.map((platform, index) => (
          <Card key={platform.name}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">{index + 1}</span>
                    {platform.name}
                  </CardTitle>
                  <p className="text-sm text-primary font-medium mt-1">{platform.best_for}</p>
                </div>
                <Badge variant="outline" className="text-xs">{platform.cost}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{platform.description}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-emerald-500 mb-2">PROS</p>
                  <ul className="space-y-1">
                    {platform.pros.map((pro, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-500 mb-2">CONSIDERATIONS</p>
                  <ul className="space-y-1">
                    {platform.cons.map((con, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5">•</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}