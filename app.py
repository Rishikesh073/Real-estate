from flask import Flask, jsonify, render_template, request, send_file
import os
import sys

# Ensure current directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from site_performance_agent import SitePerformanceAgent

app = Flask(__name__, template_folder='templates', static_folder='static')

def get_excel_path(month=None):
    filename = f'Site_Performance_Report_{month}.xlsx' if month else 'Site_Performance_Report.xlsx'
    if os.name != 'nt': # Linux (Vercel serverless)
        return os.path.join('/tmp', filename)
    else:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', filename)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/run', methods=['POST', 'GET'])
def run_analysis():
    try:
        month = request.values.get('month', '2026-06')
        agent = SitePerformanceAgent(data_dir=os.path.dirname(os.path.abspath(__file__)), month=month)
        agent.run()
        
        # Save dynamically to local static or /tmp (Vercel)
        static_excel_path = get_excel_path(month)
        agent.generate_output(output_path=static_excel_path)
        
        # Get JSON results
        results = agent.get_results_as_dict()
        return jsonify({
            "status": "success",
            "data": results
        })
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return jsonify({
            "status": "error",
            "message": str(e),
            "details": error_details
        }), 500

@app.route('/api/download')
def download_report():
    try:
        month = request.args.get('month', '2026-06')
        static_excel_path = get_excel_path(month)
        if not os.path.exists(static_excel_path):
            agent = SitePerformanceAgent(data_dir=os.path.dirname(os.path.abspath(__file__)), month=month)
            agent.run()
            agent.generate_output(output_path=static_excel_path)
        return send_file(static_excel_path, as_attachment=True, download_name=f'Site_Performance_Report_{month}.xlsx')
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    # Pre-generate on startup (only local)
    try:
        print("Pre-generating reports on startup...")
        startup_agent = SitePerformanceAgent(data_dir=os.path.dirname(os.path.abspath(__file__)))
        startup_agent.run()
        
        static_path = get_excel_path()
        startup_agent.generate_output(output_path=static_path)
        print("Startup report generation complete.")
    except Exception as startup_err:
        print(f"Startup report generation failed: {startup_err}")

    # Run server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
