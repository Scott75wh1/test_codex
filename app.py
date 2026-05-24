import base64
import io
import json

from flask import Flask, jsonify, render_template, request
import qrcode

from parser import parse_telex

app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/api/generate-qr")
def generate_qr():
    payload = request.get_json(silent=True) or {}
    telex = payload.get("telex", "")

    if not telex.strip():
        return jsonify({"error": "Campo 'telex' obbligatorio."}), 400

    parsed = parse_telex(telex)
    qr_payload = json.dumps(parsed, ensure_ascii=False)

    img = qrcode.make(qr_payload)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return jsonify(
        {
            "parsed_telex": parsed,
            "qr_data": qr_payload,
            "qr_image_base64": encoded,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
