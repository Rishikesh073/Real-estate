import pandas as pd
import json

def explore_sheet(file, sheet, skiprows):
    try:
        df = pd.read_excel(file, sheet_name=sheet, skiprows=skiprows)
        return {"columns": df.columns.tolist(), "head": df.head(3).to_dict(orient='records')}
    except Exception as e:
        return str(e)

data = {
    "Sales": explore_sheet('AI_Assignment_Input_1_Sales_SANITIZED.xlsx', 'Sales Dump', 0),
    "Construction": explore_sheet('AI_Assignment_Input_2_Construction_Tracking.xlsx', 'R5B - Daily targets', 1),
    "Collections": explore_sheet('AI_Assignment_Input_3_Collections_Tracker.xlsx', 'Collections Tracker', 1),
    "Targets_Summary": explore_sheet('AI_Assignment_Input_4_AOP_Targets.xlsx', 'Summary Targets', 1),
    "Targets_Sales": explore_sheet('AI_Assignment_Input_4_AOP_Targets.xlsx', 'Sales Targets', 1),
    "Targets_Collections": explore_sheet('AI_Assignment_Input_4_AOP_Targets.xlsx', 'Collections Targets', 1),
    "Targets_Construction": explore_sheet('AI_Assignment_Input_4_AOP_Targets.xlsx', 'Construction CoC Targets', 1),
    "Targets_NCF": explore_sheet('AI_Assignment_Input_4_AOP_Targets.xlsx', 'NCF Details Target', 1)
}

with open('exploration_output.json', 'w') as f:
    json.dump(data, f, indent=4, default=str)
print("Exploration finished")
