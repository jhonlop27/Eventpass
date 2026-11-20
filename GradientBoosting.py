import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

# Cargar dataset
df = pd.read_csv("Apendicitis.csv")

X = df.drop("Diagnosis", axis=1)
y = df["Diagnosis"]

# Identificar variables numericas y categoricas
variables_numericas = X.select_dtypes(include=["number"]).columns.tolist()

variables_categoricas = X.select_dtypes(
    include=["object", "category", "string", "bool"]
).columns.tolist()

print("Numericas:", variables_numericas)
print("Categoricas:", variables_categoricas)

# Preprocesamiento
preprocesamiento = ColumnTransformer(
    transformers=[
        ("numericas", "passthrough", variables_numericas),
        ("categoricas", OneHotEncoder(handle_unknown="ignore"), variables_categoricas)
    ]
)

# Dividir los datos
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# Crear modelo
gradient_boosting = GradientBoostingClassifier(
    n_estimators=100,
    learning_rate=0.1,
    max_depth=3,
    random_state=42
)

# Crear pipeline
from sklearn.pipeline import Pipeline

modelo = Pipeline(steps=[
    ("preprocesamiento", preprocesamiento),
    ("clasificador", gradient_boosting)
])

# Entrenar modelo
modelo.fit(X_train, y_train)

# Realizar predicciones
predicciones = modelo.predict(X_test)

# Evaluar resultados
accuracy = accuracy_score(y_test, predicciones)

print("\nRESULTADOS DEL MODELO - GRADIENT BOOSTING")
print("-----------------------------------------")
print("Registros de entrenamiento:", len(X_train))
print("Registros de prueba:", len(X_test))
print("Accuracy:", round(accuracy * 100, 2), "%")

print("\nREPORTE DE CLASIFICACIÓN")
print(classification_report(
    y_test,
    predicciones,
    zero_division=0
))

# Matriz de confusion
clases = modelo.classes_

matriz = confusion_matrix(
    y_test,
    predicciones,
    labels=clases
)

print("\nMATRIZ DE CONFUSIÓN")
print(matriz)

disp = ConfusionMatrixDisplay(
    confusion_matrix=matriz,
    display_labels=[str(clase) for clase in clases]
)

disp.plot(cmap="Blues", values_format="d")
plt.title("Matriz de confusión - Gradient Boosting")
plt.tight_layout()
plt.show()
