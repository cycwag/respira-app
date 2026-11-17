import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import joblib

def export_tree(tree_model, class_names):
    t = tree_model.tree_
    nodes = []
    for i in range(t.node_count):
        left = int(t.children_left[i])
        right = int(t.children_right[i])
        feature = int(t.feature[i])
        threshold = round(float(t.threshold[i]), 4) if feature >= 0 else None
        
        # Value contains sample count per class: shape (1, n_classes)
        class_counts = [round(float(v), 2) for v in t.value[i][0]]
        total_samples = sum(class_counts)
        probs = [round(float(v / total_samples), 4) if total_samples > 0 else 0.0 for v in class_counts]
        pred_class = int(np.argmax(class_counts))
        
        nodes.append({
            "idx": i,
            "left": left,
            "right": right,
            "feature": feature,
            "threshold": threshold,
            "probs": probs,
            "class": pred_class
        })
    return nodes

def main():
    print("Mengekspor Model Random Forest untuk Engine Inferensi JavaScript...")
    data_path = os.path.join("ml", "data", "cleaned_ispu_dataset.csv")
    df = pd.read_csv(data_path)
    
    features = ['pm25', 'pm10', 'so2', 'co', 'o3', 'no2']
    X = df[features]
    y = df['category_code']
    class_names = ["BAIK", "SEDANG", "TIDAK SEHAT"]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    # Latih Random Forest dengan 30 estimators dan kedalaman optimal 8
    rf = RandomForestClassifier(n_estimators=30, max_depth=8, random_state=42)
    rf.fit(X_train, y_train)
    
    y_pred = rf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='macro')
    cm = confusion_matrix(y_test, y_pred).tolist()
    
    print(f"✓ Model Trained: Akurasi={acc*100:.2f}%, F1-Score={f1*100:.2f}%")
    
    # Ekspor struktur pohon
    exported_trees = []
    for tree_idx, estimator in enumerate(rf.estimators_):
        nodes = export_tree(estimator, class_names)
        exported_trees.append({
            "treeId": tree_idx,
            "nodeCount": len(nodes),
            "nodes": nodes
        })
        
    export_payload = {
        "version": "1.0.0",
        "algorithm": "Random Forest Classifier",
        "nEstimators": len(exported_trees),
        "maxDepth": 8,
        "features": features,
        "classes": [
            {"code": 0, "name": "BAIK", "color": "#10b981", "badge": "badge-baik"},
            {"code": 1, "name": "SEDANG", "color": "#f59e0b", "badge": "badge-sedang"},
            {"code": 2, "name": "TIDAK SEHAT", "color": "#ef4444", "badge": "badge-tidak-sehat"}
        ],
        "metrics": {
            "testAccuracy": round(float(acc * 100), 2),
            "testF1Score": round(float(f1 * 100), 2),
            "confusionMatrix": cm,
            "testSampleCount": len(y_test)
        },
        "featureImportances": {
            feat: round(float(imp), 4) for feat, imp in zip(features, rf.feature_importances_)
        },
        "trees": exported_trees
    }
    
    os.makedirs(os.path.join("backend", "models"), exist_ok=True)
    out_json = os.path.join("backend", "models", "respira-random-forest.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, separators=(',', ':'))
        
    print(f"✓ Berhasil menyimpan payload inferensi ke: {out_json} ({os.path.getsize(out_json)/1024:.1f} KB)")
    
    # Simpan juga joblib
    joblib.dump(rf, os.path.join("ml", "ispu_model.joblib"))
    print("✓ Model joblib terupdate di ml/ispu_model.joblib")

if __name__ == "__main__":
    main()
