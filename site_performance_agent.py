import pandas as pd
import numpy as np
import datetime
import traceback
import os

class SitePerformanceAgent:
    def __init__(self, data_dir='.', month='2026-06'):
        self.data_dir = data_dir
        self.month = month
        
        self.sales_file = os.path.join(data_dir, 'AI_Assignment_Input_1_Sales_SANITIZED.xlsx')
        self.construction_file = os.path.join(data_dir, 'AI_Assignment_Input_2_Construction_Tracking.xlsx')
        self.collections_file = os.path.join(data_dir, 'AI_Assignment_Input_3_Collections_Tracker.xlsx')
        self.targets_file = os.path.join(data_dir, 'AI_Assignment_Input_4_AOP_Targets.xlsx')
        
        self.sales_df = None
        self.construction_df = None
        self.collections_df = None
        
        self.summary_targets = None
        self.sales_targets = None
        self.collections_targets = None
        self.construction_targets = None
        self.ncf_targets = None
        
        self.cash_flow_report = []
        self.progress_update = []
        self.escalation_summary = []
        self.action_plan = []
        self.data_quality_report = []
        self.draft_communications = []
        self.site_performance_report = []

    def get_report_dict(self):
        def sanitize(obj):
            if isinstance(obj, list):
                return [sanitize(x) for x in obj]
            elif isinstance(obj, dict):
                return {k: sanitize(v) for k, v in obj.items()}
            elif pd.isna(obj):
                return None
            elif isinstance(obj, (pd.Timestamp, datetime.datetime)):
                return obj.isoformat()
            elif isinstance(obj, (int, np.integer)):
                return int(obj)
            elif isinstance(obj, (float, np.floating)):
                return float(obj)
            return obj

        return {
            "site_performance_report": sanitize(self.site_performance_report),
            "cash_flow_report": sanitize(self.cash_flow_report),
            "progress_update": sanitize(self.progress_update),
            "escalation_summary": sanitize(self.escalation_summary),
            "action_plan": sanitize(self.action_plan),
            "data_quality_report": sanitize(self.data_quality_report),
            "draft_communications": sanitize(self.draft_communications)
        }

    def log_data_quality(self, file_name, field, issue_type, details):
        self.data_quality_report.append({
            'Timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'File': file_name,
            'Field/Activity': field,
            'Issue Type': issue_type,
            'Details': details
        })

    def ingest_data(self):
        try:
            self.sales_df = pd.read_excel(self.sales_file, sheet_name='Sales Dump')
        except Exception as e:
            self.log_data_quality('Sales file', 'All', 'File Read Error', str(e))

        try:
            self.construction_df = pd.read_excel(self.construction_file, sheet_name='R5B - Daily targets', skiprows=1)
            # Ensure numeric conversion for costs to prevent TypeError
            self.construction_df['Actual Cost INR'] = pd.to_numeric(self.construction_df['Actual Cost INR'], errors='coerce').fillna(0)
            self.construction_df['Planned Cost INR'] = pd.to_numeric(self.construction_df['Planned Cost INR'], errors='coerce').fillna(0)
        except Exception as e:
            self.log_data_quality('Construction file', 'All', 'File Read Error', str(e))

        try:
            self.collections_df = pd.read_excel(self.collections_file, sheet_name='Collections Tracker', header=3)
            # Ensure numeric conversion for actual collected and outstanding amounts to avoid type errors
            self.collections_df['Amount Collected'] = pd.to_numeric(self.collections_df['Amount Collected'], errors='coerce').fillna(0)
            self.collections_df['Outstanding Amount'] = pd.to_numeric(self.collections_df['Outstanding Amount'], errors='coerce').fillna(0)
        except Exception as e:
            self.log_data_quality('Collections file', 'All', 'File Read Error', str(e))

        try:
            self.summary_targets = pd.read_excel(self.targets_file, sheet_name='Summary Targets', skiprows=1)
            # Scale summary targets from Crores to Rupees (10,000,000 INR)
            for col in ['Booking Value Target', 'Collections Target', 'CoC Target', 'Other Cost Target', 'NCF Pre-BD Target']:
                if col in self.summary_targets.columns:
                    self.summary_targets[col] = pd.to_numeric(self.summary_targets[col], errors='coerce').fillna(0) * 10000000

            self.sales_targets = pd.read_excel(self.targets_file, sheet_name='Sales Targets', skiprows=1)
            for col in ['Booking Value Target', 'Avg 1BHK Value', 'Avg 2BHK Value', 'Avg 3BHK Value']:
                if col in self.sales_targets.columns:
                    self.sales_targets[col] = pd.to_numeric(self.sales_targets[col], errors='coerce').fillna(0) * 10000000

            self.collections_targets = pd.read_excel(self.targets_file, sheet_name='Collections Targets', skiprows=1)
            if 'Expected Demand Value' in self.collections_targets.columns:
                self.collections_targets['Expected Demand Value'] = pd.to_numeric(self.collections_targets['Expected Demand Value'], errors='coerce').fillna(0) * 10000000

            self.construction_targets = pd.read_excel(self.targets_file, sheet_name='Construction CoC Targets', skiprows=1)
            if 'Planned CoC' in self.construction_targets.columns:
                self.construction_targets['Planned CoC'] = pd.to_numeric(self.construction_targets['Planned CoC'], errors='coerce').fillna(0) * 10000000

            self.ncf_targets = pd.read_excel(self.targets_file, sheet_name='NCF Details Target', skiprows=1)
            for col in ['Collection Target', 'CoC Target', 'Other Cost excl. Land & Interest', 'Marketing & Brokerage', 'MOSA', 'Liaison & Approvals', 'Income Tax', 'Other Outflow', 'Interest Cost', 'SPV OCF', 'SPV NCF', 'GPL Pre-BD NCF']:
                if col in self.ncf_targets.columns:
                    self.ncf_targets[col] = pd.to_numeric(self.ncf_targets[col], errors='coerce').fillna(0) * 10000000
        except Exception as e:
            self.log_data_quality('Targets file', 'All', 'File Read Error', str(e))

        self.filter_data_by_month()

    def filter_data_by_month(self):
        if not self.month or self.month == 'Q1':
            # Remove 'Q1 Total' row from targets to avoid double counting if summing targets
            if self.summary_targets is not None:
                self.summary_targets = self.summary_targets[self.summary_targets['Month'] != 'Q1 Total']
            if self.sales_targets is not None:
                self.sales_targets = self.sales_targets[self.sales_targets['Month'] != 'Q1 Total']
            if self.collections_targets is not None:
                self.collections_targets = self.collections_targets[self.collections_targets['Month'] != 'Q1 Total']
            if self.construction_targets is not None:
                self.construction_targets = self.construction_targets[self.construction_targets['Month'] != 'Q1 Total']
            if self.ncf_targets is not None:
                self.ncf_targets = self.ncf_targets[self.ncf_targets['Month'] != 'Q1 Total']
            return

        # Map month_str like '2026-06' to year=2026, month=6
        try:
            year, month = map(int, self.month.split('-'))
        except Exception as e:
            self.log_data_quality('System Rules', 'System', 'Month Format Parse Error', f"{self.month}: {e}")
            return

        # 1. Filter targets by Month column
        def filter_target_df(df):
            if df is None or 'Month' not in df.columns:
                return df
            df_copy = df.copy()
            df_copy['ParsedMonth'] = pd.to_datetime(df_copy['Month'], errors='coerce')
            filtered = df_copy[(df_copy['ParsedMonth'].dt.year == year) & (df_copy['ParsedMonth'].dt.month == month)]
            return filtered.drop(columns=['ParsedMonth'])

        self.summary_targets = filter_target_df(self.summary_targets)
        self.sales_targets = filter_target_df(self.sales_targets)
        self.collections_targets = filter_target_df(self.collections_targets)
        self.construction_targets = filter_target_df(self.construction_targets)
        self.ncf_targets = filter_target_df(self.ncf_targets)

        # 2. Filter actual Sales Dump by Booking Date
        if self.sales_df is not None and 'Booking Date' in self.sales_df.columns:
            if pd.api.types.is_numeric_dtype(self.sales_df['Booking Date']):
                self.sales_df['Booking Date'] = pd.to_datetime(self.sales_df['Booking Date'], unit='D', origin='1899-12-30', errors='coerce')
            else:
                self.sales_df['Booking Date'] = pd.to_datetime(self.sales_df['Booking Date'], errors='coerce')
            
            self.sales_df = self.sales_df[(self.sales_df['Booking Date'].dt.year == year) & (self.sales_df['Booking Date'].dt.month == month)]

        # 3. Filter actual Collections Tracker by Due Date
        if self.collections_df is not None and 'Due Date' in self.collections_df.columns:
            self.collections_df['Due Date'] = pd.to_datetime(self.collections_df['Due Date'], errors='coerce')
            self.collections_df = self.collections_df[(self.collections_df['Due Date'].dt.year == year) & (self.collections_df['Due Date'].dt.month == month)]

        # 4. Filter actual Construction Tracker by Planned Finish date
        if self.construction_df is not None and 'Planned Finish' in self.construction_df.columns:
            self.construction_df['Planned Finish_numeric'] = pd.to_numeric(self.construction_df['Planned Finish'], errors='coerce')
            self.construction_df['Planned Finish_parsed'] = pd.to_datetime(self.construction_df['Planned Finish_numeric'], unit='D', origin='1899-12-30', errors='coerce')
            
            self.construction_df = self.construction_df[(self.construction_df['Planned Finish_parsed'].dt.year == year) & (self.construction_df['Planned Finish_parsed'].dt.month == month)]

    def apply_sales_rules(self):
        if self.sales_df is None or self.sales_targets is None:
            return
            
        try:
            # Sales Risk: If actual monthly booking value < 80% of AOP target
            total_actual_booking = self.sales_df['Total Agreement Amount'].sum()
            total_target_booking = self.sales_targets['Booking Value Target'].sum()
            
            sales_heads = self.sales_targets['Sales Head'].dropna().unique()
            sales_head = sales_heads[0] if len(sales_heads) > 0 else 'Unknown Sales Head'
            project_name = self.sales_df['Project: Project Name'].dropna().unique()[0] if len(self.sales_df['Project: Project Name'].dropna().unique()) > 0 else 'Eden Square'
            
            achievement_rate = (total_actual_booking / total_target_booking) if total_target_booking > 0 else 0
            
            if total_target_booking > 0 and achievement_rate < 0.8:
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Sales Risk',
                    'Metric Impacted': 'Booking Value',
                    'Reason': f"Actual ({total_actual_booking:,.0f}) is < 80% of Target ({total_target_booking:,.0f}) (Achievement: {achievement_rate:.1%})",
                    'Suggested Owner': sales_head,
                    'Required Action': 'Prepare sales recovery and incentive pipeline plan',
                    'Due Date': 'Immediate',
                    'Severity': 'Red'
                })
                self.action_plan.append({
                    'Owner': sales_head,
                    'Department': 'Sales',
                    'Task': 'Formulate and deploy marketing campaign for BHK configurations with low sales velocity',
                    'Priority': 'High',
                    'Due Date': 'Immediate'
                })
                self.draft_communications.append({
                    'Recipient': sales_head,
                    'Channel': 'Teams / Email',
                    'Message': f"Urgent Action Required: Q1 actual booking value ({total_actual_booking:,.0f} INR) is underperforming vs targets ({total_target_booking:,.0f} INR). Please draft a configuration-wise action plan."
                })

            # Product Mix Risk
            type_counts = self.sales_df['Type'].value_counts()
            units_1bhk_actual = type_counts.get('1 BHK', 0)
            units_2bhk_actual = type_counts.get('2 BHK', 0)
            units_3bhk_actual = type_counts.get('3 BHK', 0)
            
            units_1bhk_target = self.sales_targets['1BHK Units Target'].sum()
            units_2bhk_target = self.sales_targets['2BHK Units Target'].sum()
            units_3bhk_target = self.sales_targets['3BHK Units Target'].sum()
            
            mix_issues = []
            if units_1bhk_target > 0 and (units_1bhk_actual < 0.8 * units_1bhk_target): mix_issues.append('1BHK')
            if units_2bhk_target > 0 and (units_2bhk_actual < 0.8 * units_2bhk_target): mix_issues.append('2BHK')
            if units_3bhk_target > 0 and (units_3bhk_actual < 0.8 * units_3bhk_target): mix_issues.append('3BHK')
            
            if mix_issues:
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Product Mix Risk',
                    'Metric Impacted': 'Unit Sales Mix',
                    'Reason': f"Shortfall in units sold for configs: {', '.join(mix_issues)}",
                    'Suggested Owner': sales_head,
                    'Required Action': 'Review pricing Strategy or offer targeted schemes for lagging configurations',
                    'Due Date': 'Next 7 Days',
                    'Severity': 'Amber'
                })
                self.action_plan.append({
                    'Owner': sales_head,
                    'Department': 'Sales',
                    'Task': f"Re-evaluate customer positioning and broker brokerage rates for: {', '.join(mix_issues)}",
                    'Priority': 'Medium',
                    'Due Date': 'Next 7 Days'
                })
                
            self.progress_update.append({
                'Category': 'Sales',
                'Metric': 'Booking Value',
                'Actual': total_actual_booking,
                'Target': total_target_booking,
                'Variance': total_actual_booking - total_target_booking,
                'Status/Achievement': f"{achievement_rate:.1%} Achieved"
            })
            
            # Product configurations progress details
            self.progress_update.append({
                'Category': 'Sales',
                'Metric': '1BHK Units Sold',
                'Actual': units_1bhk_actual,
                'Target': units_1bhk_target,
                'Variance': units_1bhk_actual - units_1bhk_target,
                'Status/Achievement': f"{units_1bhk_actual} vs Target {units_1bhk_target}"
            })
            self.progress_update.append({
                'Category': 'Sales',
                'Metric': '2BHK Units Sold',
                'Actual': units_2bhk_actual,
                'Target': units_2bhk_target,
                'Variance': units_2bhk_actual - units_2bhk_target,
                'Status/Achievement': f"{units_2bhk_actual} vs Target {units_2bhk_target}"
            })
            self.progress_update.append({
                'Category': 'Sales',
                'Metric': '3BHK Units Sold',
                'Actual': units_3bhk_actual,
                'Target': units_3bhk_target,
                'Variance': units_3bhk_actual - units_3bhk_target,
                'Status/Achievement': f"{units_3bhk_actual} vs Target {units_3bhk_target}"
            })
            
        except Exception as e:
            self.log_data_quality('Sales file', 'Multiple', 'Sales Rule Processing Error', str(e))

    def apply_collections_rules(self):
        if self.collections_df is None or self.summary_targets is None:
            return
            
        try:
            # Collections Risk: actual collections < 85% of target
            total_collected = self.collections_df['Amount Collected'].sum()
            collections_target = self.summary_targets['Collections Target'].sum()
            
            project_name = self.collections_df['Project Name'].dropna().unique()[0] if len(self.collections_df['Project Name'].dropna().unique()) > 0 else 'Eden Square'
            
            achievement_rate = (total_collected / collections_target) if collections_target > 0 else 0
            
            if collections_target > 0 and achievement_rate < 0.85:
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Collections Risk',
                    'Metric Impacted': 'Total Collections',
                    'Reason': f"Actual ({total_collected:,.0f}) is < 85% of Target ({collections_target:,.0f}) (Achievement: {achievement_rate:.1%})",
                    'Suggested Owner': 'Collections Head',
                    'Required Action': 'Initiate intensive customer reminders and follow-ups',
                    'Due Date': 'Immediate',
                    'Severity': 'Red'
                })
                self.action_plan.append({
                    'Owner': 'Collections Head',
                    'Department': 'Collections',
                    'Task': 'Formulate and deploy collection camps and coordinate broker mediation',
                    'Priority': 'High',
                    'Due Date': 'Immediate'
                })

            # Overdue > 30 days
            overdue_df = self.collections_df[pd.to_numeric(self.collections_df['Days Overdue'], errors='coerce') > 30]
            for _, row in overdue_df.iterrows():
                owner = row.get('Collections Owner', 'Unknown Owner')
                cust = row.get('Customer Name', 'Unknown Customer')
                days = row.get('Days Overdue')
                amt = row.get('Outstanding Amount')
                
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Collection Priority',
                    'Metric Impacted': 'Overdue customer billing milestone',
                    'Reason': f"Customer {cust} is overdue by {days} days",
                    'Suggested Owner': owner,
                    'Required Action': f"Direct demand follow up for overdue invoice of {amt:,.0f} INR",
                    'Due Date': 'Next 48 Hours',
                    'Severity': 'Amber'
                })
                self.draft_communications.append({
                    'Recipient': owner,
                    'Channel': 'Teams / Email',
                    'Message': f"Follow-up Alert: Customer {cust} is currently {days} days overdue with outstanding amount of {amt:,.0f} INR. Please issue formal dunning notice."
                })
                
            self.progress_update.append({
                'Category': 'Collections',
                'Metric': 'Total Collections',
                'Actual': total_collected,
                'Target': collections_target,
                'Variance': total_collected - collections_target,
                'Status/Achievement': f"{achievement_rate:.1%} Achieved"
            })
                
        except Exception as e:
            self.log_data_quality('Collections file', 'Multiple', 'Collections Rule Processing Error', str(e))

    def apply_construction_rules(self):
        if self.construction_df is None or self.construction_targets is None:
            return
            
        try:
            total_actual_cost = self.construction_df['Actual Cost INR'].sum()
            total_target_cost = self.construction_targets['Planned CoC'].sum()
            project_name = 'Eden Square' # Standard site name for Construction Tracking
            
            cost_achievement = (total_actual_cost / total_target_cost) if total_target_cost > 0 else 0
            
            # Cost Overrun
            if total_target_cost > 0 and total_actual_cost > (1.1 * total_target_cost):
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Cost Overrun',
                    'Metric Impacted': 'Construction Cost (CoC)',
                    'Reason': f"Actual cost ({total_actual_cost:,.0f}) exceeds target ({total_target_cost:,.0f}) by {(cost_achievement - 1):.1%}",
                    'Suggested Owner': 'Construction Head',
                    'Required Action': 'Perform root-cause analysis on contractor contracts and bills',
                    'Due Date': 'Immediate',
                    'Severity': 'Red'
                })
                self.action_plan.append({
                    'Owner': 'Construction Head',
                    'Department': 'Construction',
                    'Task': 'Re-negotiate supply pricing and vendor contracts to stabilize Cost Overrun',
                    'Priority': 'High',
                    'Due Date': 'Next 14 Days'
                })
            
            # Delay Risk > 15 days
            delayed_df = self.construction_df[pd.to_numeric(self.construction_df['Delay Days'], errors='coerce') > 15]
            for _, row in delayed_df.iterrows():
                owner = str(row.get('Responsible Owner', 'Unknown Owner'))
                activity = row.get('Activity', 'Unknown Activity')
                delay = row.get('Delay Days')
                reason = row.get('Delay Reason')
                
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Construction Delay Risk',
                    'Metric Impacted': 'Milestone Progress',
                    'Reason': f"Activity '{activity}' delayed by {delay} days due to: {reason}",
                    'Suggested Owner': owner,
                    'Required Action': 'Deploy extra labor forces to expedite construction process',
                    'Due Date': 'Immediate',
                    'Severity': 'Red'
                })
                self.action_plan.append({
                    'Owner': owner,
                    'Department': 'Construction',
                    'Task': f"Expedite delayed activity: '{activity}' (Currently delayed by {delay} days)",
                    'Priority': 'High',
                    'Due Date': 'Next 7 Days'
                })
                
                # Missing Data Flag
                if pd.isna(reason) or str(reason).strip() == '' or str(reason).lower() == 'nan':
                    self.log_data_quality('Construction file', activity, 'Clarification Required', f"Activity delayed by {delay} days but 'Delay Reason' is missing.")

            self.progress_update.append({
                'Category': 'Construction',
                'Metric': 'Construction Cost',
                'Actual': total_actual_cost,
                'Target': total_target_cost,
                'Variance': total_target_cost - total_actual_cost, # Positive variance means under budget
                'Status/Achievement': f"{total_actual_cost:,.0f} Spent vs Target {total_target_cost:,.0f}"
            })
                
        except Exception as e:
            self.log_data_quality('Construction file', 'Multiple', 'Construction Rule Processing Error', str(e))

    def apply_cash_flow_rules(self):
        if self.construction_df is None or self.collections_df is None or self.summary_targets is None:
            return
            
        try:
            # Cash Flow Leakage: construction milestone complete (Progress = 100) but collection not received
            completed_milestones = self.construction_df[self.construction_df['Actual Progress %'] == 100]['Activity'].tolist()
            project_name = 'Eden Square'
            
            leakage_risks = []
            for _, row in self.collections_df.iterrows():
                milestone = row.get('Milestone Linked')
                status = row.get('Collection Status')
                due_date = pd.to_datetime(row.get('Due Date'), errors='coerce')
                
                if milestone in completed_milestones and status != 'Paid':
                    if pd.notna(due_date) and due_date < datetime.datetime.now():
                        msg = f"Milestone '{milestone}' is 100% complete but the collection status is '{status}' past due deadline ({due_date.strftime('%Y-%m-%d')})"
                        leakage_risks.append(milestone)
                        self.escalation_summary.append({
                            'Project': project_name,
                            'Item': 'Cash-flow Leakage',
                            'Metric Impacted': 'Milestone Collection',
                            'Reason': msg,
                            'Suggested Owner': row.get('Collections Owner', 'Collections Head'),
                            'Required Action': 'Trigger demand notice linked to completion certificate immediately',
                            'Due Date': 'Immediate',
                            'Severity': 'Red'
                        })
            
            # Net Cash Flow (NCF) = Collections Inflow - (Construction CoC Outflow + Other AOP Costs)
            inflow = self.collections_df['Amount Collected'].sum()
            outflow_coc = self.construction_df['Actual Cost INR'].sum()
            outflow_other = self.summary_targets['Other Cost Target'].sum() if 'Other Cost Target' in self.summary_targets.columns else 0
            
            actual_ncf = inflow - (outflow_coc + outflow_other)
            target_ncf = self.summary_targets['NCF Pre-BD Target'].sum() if 'NCF Pre-BD Target' in self.summary_targets.columns else 0
            
            top_risks = ", ".join(leakage_risks[:3]) if leakage_risks else "None"
            
            self.cash_flow_report.append({
                'Metric': 'Net Cash Flow',
                'Actual Inflow': inflow,
                'Collections Due / Overdue': self.collections_df[self.collections_df['Collection Status'] != 'Paid']['Outstanding Amount'].sum(),
                'Actual Outflow CoC': outflow_coc,
                'Other Costs': outflow_other,
                'Actual NCF': actual_ncf,
                'Target NCF': target_ncf,
                'Variance vs Target': actual_ncf - target_ncf,
                'Top Cash-flow Risks': f"Unpaid complete milestones: {top_risks}"
            })
            
        except Exception as e:
            self.log_data_quality('Collections / Construction', 'Multiple', 'Cash Flow Rule Processing Error', str(e))

    def cross_functional_escalation(self):
        try:
            # If Sales Risk AND (Collections OR Construction risk)
            has_sales_risk = any(e['Item'] == 'Sales Risk' for e in self.escalation_summary)
            has_coll_risk = any(e['Item'] == 'Collections Risk' for e in self.escalation_summary)
            has_const_risk = any(e['Item'] == 'Construction Delay Risk' for e in self.escalation_summary)
            
            project_name = 'Eden Square'
            
            if has_sales_risk and (has_coll_risk or has_const_risk):
                self.escalation_summary.append({
                    'Project': project_name,
                    'Item': 'Cross-functional escalation',
                    'Metric Impacted': 'Project Viability / NCF',
                    'Reason': "Coinciding Sales Risk with critical Collections / Construction milestones delay.",
                    'Suggested Owner': 'Project Head',
                    'Required Action': 'Convene emergency review board meeting to align cross-functional targets',
                    'Due Date': 'Immediate',
                    'Severity': 'Red'
                })
        except Exception as e:
            self.log_data_quality('System Rules', 'System', 'Cross Functional Escalation Error', str(e))

    def build_performance_report(self):
        # Build the final Month-End Site Performance Report
        try:
            # Key Decision items inspired by CBE Review
            self.site_performance_report.append({
                'Section': 'Overview Metrics',
                'Key Metric': 'Total Booking Value Achievement',
                'Value / Detail': f"{self.progress_update[0]['Status/Achievement'] if self.progress_update else 'N/A'}",
                'Status': 'Needs Review',
                'Key Decision Item': 'Establish Q1 promotional campaigns & broker schemes.'
            })
            self.site_performance_report.append({
                'Section': 'Overview Metrics',
                'Key Metric': 'Collections Target Achievement',
                'Value / Detail': f"{self.progress_update[4]['Status/Achievement'] if len(self.progress_update) > 4 else 'N/A'}",
                'Status': 'Critically Delayed',
                'Key Decision Item': 'Escalate dunning notices for bills overdue >30 days.'
            })
            self.site_performance_report.append({
                'Section': 'Overview Metrics',
                'Key Metric': 'Construction CoC Target Achievement',
                'Value / Detail': f"{self.progress_update[5]['Status/Achievement'] if len(self.progress_update) > 5 else 'N/A'}",
                'Status': 'On Track',
                'Key Decision Item': 'Maintain progress while tracking raw material cost trends.'
            })
            self.site_performance_report.append({
                'Section': 'Net Cash Flow',
                'Key Metric': 'Variance vs AOP Target',
                'Value / Detail': f"Underperforming target by {self.cash_flow_report[0]['Variance vs Target']:,.0f} INR" if self.cash_flow_report else 'N/A',
                'Status': 'Deficit Risk',
                'Key Decision Item': 'Utilize backup credit facility or delay non-critical project expenditures.'
            })
        except Exception as e:
            self.log_data_quality('System Rules', 'System', 'Performance Report Construction Error', str(e))

    def generate_output(self, output_path='Site_Performance_Report.xlsx'):
        try:
            with pd.ExcelWriter(output_path, engine='xlsxwriter') as writer:
                # 1. Month-End Site Performance Report
                if self.site_performance_report:
                    pd.DataFrame(self.site_performance_report).to_excel(writer, sheet_name='Site Performance Report', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Data'}]).to_excel(writer, sheet_name='Site Performance Report', index=False)

                # 2. Cash Flow Report
                if self.cash_flow_report:
                    pd.DataFrame(self.cash_flow_report).to_excel(writer, sheet_name='Cash Flow Report', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Data'}]).to_excel(writer, sheet_name='Cash Flow Report', index=False)

                # 3. Progress Update
                if self.progress_update:
                    pd.DataFrame(self.progress_update).to_excel(writer, sheet_name='Progress Update', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Data'}]).to_excel(writer, sheet_name='Progress Update', index=False)

                # 4. Escalation Summary
                if self.escalation_summary:
                    pd.DataFrame(self.escalation_summary).to_excel(writer, sheet_name='Escalation Summary', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Data'}]).to_excel(writer, sheet_name='Escalation Summary', index=False)

                # 5. Action Plan
                if self.action_plan:
                    pd.DataFrame(self.action_plan).to_excel(writer, sheet_name='Action Plan', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Data'}]).to_excel(writer, sheet_name='Action Plan', index=False)

                # 6. Data Quality Report
                if self.data_quality_report:
                    pd.DataFrame(self.data_quality_report).to_excel(writer, sheet_name='Data Quality Report', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Issues Found'}]).to_excel(writer, sheet_name='Data Quality Report', index=False)

                # 7. Draft Communications
                if self.draft_communications:
                    pd.DataFrame(self.draft_communications).to_excel(writer, sheet_name='Draft Communications', index=False)
                else:
                    pd.DataFrame([{'Message': 'No Drafts'}]).to_excel(writer, sheet_name='Draft Communications', index=False)

                # Applying basic formatting
                workbook = writer.book
                for sheet_name in writer.sheets:
                    worksheet = writer.sheets[sheet_name]
                    worksheet.set_column('A:Z', 22)
                         
            print(f"Successfully generated report at {output_path}")
        except Exception as e:
            print(f"Error generating output: {e}")

    def apply_data_quality_cross_checks(self):
        try:
            # 1. Milestone Linkage Check
            if self.collections_df is not None and self.construction_df is not None:
                collections_milestones = set(self.collections_df['Milestone Linked'].dropna().astype(str).str.strip().unique())
                construction_activities = set(self.construction_df['Activity'].dropna().astype(str).str.strip().unique())
                
                mismatched_milestones = collections_milestones - construction_activities
                for m in mismatched_milestones:
                    if m.lower() not in ['nan', 'none', '']:
                        self.log_data_quality(
                            'Collections Tracker', 
                            m, 
                            'Milestone Mismatch', 
                            f"Milestone Linked '{m}' in Collections does not match any Activity in Construction Daily targets."
                        )
                        
            # 2. Customer Inconsistency Check
            if self.collections_df is not None and self.sales_df is not None:
                collections_cust_codes = set(self.collections_df['Customer Code'].dropna().astype(str).str.strip().unique())
                sales_cust_codes = set(self.sales_df['Customer Code'].dropna().astype(str).str.strip().unique())
                
                mismatched_codes = collections_cust_codes - sales_cust_codes
                for c in mismatched_codes:
                    if c.lower() not in ['nan', 'none', '']:
                        cust_name = self.collections_df[self.collections_df['Customer Code'] == c]['Customer Name'].dropna().unique()
                        cust_str = cust_name[0] if len(cust_name) > 0 else 'Unknown'
                        self.log_data_quality(
                            'Collections Tracker', 
                            f"Cust Code: {c}", 
                            'Customer Mismatch', 
                            f"Customer '{cust_str}' (Code: {c}) exists in Collections but has no matching sales record in Sales Dump."
                        )

            # 3. Unit Code Inconsistency Check
            if self.collections_df is not None and self.sales_df is not None:
                collections_units = set(self.collections_df['Unit Number'].dropna().astype(str).str.strip().unique())
                sales_units = set(self.sales_df['Unit'].dropna().astype(str).str.strip().unique())
                
                mismatched_units = collections_units - sales_units
                for u in mismatched_units:
                    if u.lower() not in ['nan', 'none', '']:
                        self.log_data_quality(
                            'Collections Tracker', 
                            f"Unit: {u}", 
                            'Unit Mismatch', 
                            f"Unit '{u}' exists in Collections but has no corresponding booking record in Sales Dump."
                        )
        except Exception as e:
            self.log_data_quality('System Rules', 'System', 'Cross checks Validation Error', str(e))

    def run(self):
        self.ingest_data()
        self.apply_sales_rules()
        self.apply_collections_rules()
        self.apply_construction_rules()
        self.apply_cash_flow_rules()
        self.cross_functional_escalation()
        self.apply_data_quality_cross_checks()
        self.build_performance_report()
        self.generate_output()

    def get_results_as_dict(self):
        return self.get_report_dict()

if __name__ == "__main__":
    agent = SitePerformanceAgent()
    agent.run()
