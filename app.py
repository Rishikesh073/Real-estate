from flask import Flask, jsonify, render_template, request
import os
import sys

# Ensure current directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from site_performance_agent import SitePerformanceAgent

app = Flask(__name__, template_folder='templates', static_folder='static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/run', methods=['POST', 'GET'])
def run_analysis():
    try:
        month = request.values.get('month', '2026-06')
        agent = SitePerformanceAgent(data_dir=os.path.dirname(os.path.abspath(__file__)), month=month)
        agent.run()
        
        # Save static version for download
        static_excel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'Site_Performance_Report.xlsx')
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

if __name__ == '__main__':
    # Pre-generate on startup
    try:
        print("Pre-generating reports on startup...")
        startup_agent = SitePerformanceAgent(data_dir=os.path.dirname(os.path.abspath(__file__)))
        startup_agent.run()
        
        static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'Site_Performance_Report.xlsx')
        startup_agent.generate_output(output_path=static_path)
        print("Startup report generation complete.")
    except Exception as startup_err:
        print(f"Startup report generation failed: {startup_err}")

    # Run server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
