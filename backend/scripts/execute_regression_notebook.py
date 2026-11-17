"""
RESPIRA - Execute Notebook and Populate Outputs & Artifacts
Runs code cells from ml/RESPIRA_Multivariate_Regression_Pipeline.ipynb in ml/ directory,
captures stdout, text representations, and base64 matplotlib figures.
"""
import io
import sys
import json
import base64
import contextlib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def run_notebook():
    nb_path = 'ml/RESPIRA_Multivariate_Regression_Pipeline.ipynb'
    with open(nb_path, 'r', encoding='utf-8') as f:
        nb = json.load(f)

    # Change working directory to ml/ so relative paths like 'data/...' work
    import os
    orig_cwd = os.getcwd()
    os.chdir('ml')

    exec_globals = {}
    exec_count = 1

    for cell_idx, cell in enumerate(nb['cells']):
        if cell['cell_type'] != 'code':
            continue

        code_text = "".join(cell['source'])
        print(f"Executing code cell {cell_idx}...")

        stdout_buf = io.StringIO()
        plt.close('all')

        cell_outputs = []
        try:
            with contextlib.redirect_stdout(stdout_buf):
                exec(code_text, exec_globals)
        except Exception as e:
            print(f"Error in cell {cell_idx}: {e}")
            cell_outputs.append({
                "output_type": "error",
                "ename": type(e).__name__,
                "evalue": str(e),
                "traceback": [str(e)]
            })

        # Capture stdout
        out_str = stdout_buf.getvalue()
        if out_str:
            cell_outputs.append({
                "output_type": "stream",
                "name": "stdout",
                "text": [line + "\n" for line in out_str.strip().split("\n")]
            })

        # Capture any matplotlib figures produced in this cell
        figs = [plt.figure(num) for num in plt.get_fignums()]
        for fig in figs:
            img_buf = io.BytesIO()
            fig.savefig(img_buf, format='png', bbox_inches='tight', dpi=100)
            img_buf.seek(0)
            b64_img = base64.b64encode(img_buf.read()).decode('utf-8')
            cell_outputs.append({
                "output_type": "display_data",
                "data": {
                    "image/png": b64_img,
                    "text/plain": ["<Figure size ...>"]
                },
                "metadata": {}
            })
            plt.close(fig)

        cell['outputs'] = cell_outputs
        cell['execution_count'] = exec_count
        exec_count += 1

    os.chdir(orig_cwd)

    with open(nb_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=2)

    print(f"✓ Notebook {nb_path} berhasil dieksekusi dan seluruh output grafik/tabel tersimpan!")

if __name__ == '__main__':
    run_notebook()
