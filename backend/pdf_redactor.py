"""
PDF Redactor - Backend service to redact sensitive text in PDFs
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz  # PyMuPDF
import io
import base64

app = Flask(__name__)
CORS(app)

def redact_pdf_text(pdf_bytes, spans_by_page):
    """
    Redact text in PDF by replacing sensitive text with asterisks.
    
    Args:
        pdf_bytes: The PDF file bytes
        spans_by_page: Dict mapping page index (as string) to list of spans
                      Each span has: {text, charStart, charEnd}
    
    Returns:
        Modified PDF bytes
    """
    # Open PDF from bytes
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    # Process each page
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        
        # Get spans for this page
        spans = spans_by_page.get(str(page_idx), [])
        
        if not spans:
            continue
        
        # For each span, find the text instances and redact them
        for span in spans:
            text_to_find = span.get('text', '')
            char_start = span.get('charStart', 0)
            char_end = span.get('charEnd', len(text_to_find))
            
            if not text_to_find or char_start >= char_end:
                continue
            
            # Get the portion to redact
            portion_to_redact = text_to_find[char_start:char_end]
            replacement_text = '*' * (char_end - char_start)
            
            # Search for all instances of this text on the page
            text_instances = page.search_for(text_to_find)
            
            for inst in text_instances:
                # Get the rectangle for this text instance
                rect = inst
                
                # Calculate the portion of the rectangle to redact
                # This is approximate since we don't have exact character positions
                if char_start > 0 or char_end < len(text_to_find):
                    # Partial redaction - estimate the sub-rectangle
                    text_width = rect.width
                    char_width = text_width / len(text_to_find) if len(text_to_find) > 0 else 0
                    
                    start_x = rect.x0 + (char_start * char_width)
                    end_x = rect.x0 + (char_end * char_width)
                    
                    redact_rect = fitz.Rect(start_x, rect.y0, end_x, rect.y1)
                else:
                    # Full text redaction
                    redact_rect = rect
                
                # Add redaction annotation
                annot = page.add_redact_annot(redact_rect, text=replacement_text, 
                                              fill=(1, 1, 1),  # white fill
                                              text_color=(0, 0, 0))  # black text
    
    # Apply all redactions
    for page in doc:
        page.apply_redactions()
    
    # Save to bytes
    output = io.BytesIO()
    doc.save(output)
    doc.close()
    
    return output.getvalue()


@app.route('/api/redact-pdf', methods=['POST'])
def redact_pdf():
    """
    API endpoint to redact sensitive text in a PDF.
    
    Expected JSON:
    {
        "pdf": base64-encoded PDF bytes,
        "spans": {
            "0": [{"text": "Jane Doe", "charStart": 0, "charEnd": 4}, ...],
            "1": [...],
            ...
        }
    }
    """
    try:
        data = request.get_json()
        
        # Decode PDF
        pdf_base64 = data.get('pdf', '')
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Get spans
        spans_data = data.get('spans', {})
        
        # Redact PDF
        redacted_bytes = redact_pdf_text(pdf_bytes, spans_data)
        
        # Return as base64
        redacted_base64 = base64.b64encode(redacted_bytes).decode('utf-8')
        
        return jsonify({
            'status': 'success',
            'pdf': redacted_base64
        })
    
    except Exception as e:
        import traceback
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
