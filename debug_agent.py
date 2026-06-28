from site_performance_agent import SitePerformanceAgent
import pandas as pd

agent = SitePerformanceAgent()
agent.ingest_data()

print("Sales DF shape:", agent.sales_df.shape if agent.sales_df is not None else "None")
print("Construction DF shape:", agent.construction_df.shape if agent.construction_df is not None else "None")
print("Collections DF shape:", agent.collections_df.shape if agent.collections_df is not None else "None")
print("Summary Targets shape:", agent.summary_targets.shape if agent.summary_targets is not None else "None")

agent.apply_sales_rules()
print("Escalation Summary:", agent.escalation_summary)
print("Action Plan:", agent.action_plan)

agent.apply_collections_rules()
print("Progress Update:", agent.progress_update)

agent.apply_construction_rules()
agent.apply_cash_flow_rules()
print("Cash Flow Report:", agent.cash_flow_report)
print("Data Quality Report:", agent.data_quality_report)
