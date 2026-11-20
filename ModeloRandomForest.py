from pathlib import Path  # Permite buscar el CSV en la carpeta de este script.

import matplotlib.pyplot as plt  # Permite dibujar la matriz de confusión.
import pandas as pd  # Permite leer el CSV y trabajar con sus filas y columnas.
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report  # Resume el desempeño del modelo por clase.
from sklearn.metrics import confusion_matrix  # Cuenta los aciertos y errores por diagnóstico.
from sklearn.model_selection import train_test_split  # Separa los datos para entrenar y evaluar.

# 1. Cargar y revisar los datos
archivo = Path(__file__).with_name("Apendicitis.csv")  # Busca el CSV junto a este archivo .py.
df = pd.read_csv(archivo)  # Lee el CSV y guarda los datos en una tabla llamada df.
print(df.head())  # Muestra los primeros cinco registros.
print(df.tail())  # Muestra los últimos cinco registros.

# 2. Separar los datos de entrada (X) y la respuesta que queremos predecir (y)
X = df.drop(columns="Diagnosis")  # Usa las 35 columnas numéricas de entrada, como edad, peso y síntomas.
y = df["Diagnosis"]  # El CSV ya guarda el diagnóstico como número: 0 = sin apendicitis, 1 = con apendicitis.

# 3. Dividir los registros en dos grupos con sus diagnósticos correspondientes
X_train, X_test, y_train, y_test = train_test_split(
    X, y,             # Divide las filas de X junto con sus respuestas de y.
    test_size=0.2,    # Reserva el 20 % para pruebas y usa el 80 % para entrenamiento.  # Repite la misma división cada vez que se ejecuta el código.
    stratify=y,       # Mantiene una proporción similar de ambos diagnósticos en cada grupo.
)

# 4. Entrenar Random Forest con las columnas numéricas del CSV y predecir
clf = RandomForestClassifier(random_state=42)  # Crea el clasificador con una semilla fija para repetir el experimento.
clf.fit(X_train, y_train)  # Aprende a relacionar los datos de entrenamiento con sus diagnósticos.
y_pred = clf.predict(X_test)  # Predice 0 o 1 para cada registro de prueba.

# 5. Comparar las predicciones con los diagnósticos reales
clases = ["Sin apendicitis", "Con apendicitis"]  # Nombres de las clases 0 y 1, en ese orden.
cm = confusion_matrix(y_test, y_pred, labels=[0, 1])  # Cuenta cuántos casos de cada clase recibieron cada predicción.
confusion = pd.DataFrame(cm, index=clases, columns=clases)  # Coloca los conteos en una tabla con nombres.
confusion.index.name = "Diagnóstico real"  # Las filas indican el diagnóstico registrado en el CSV.
confusion.columns.name = "Predicción"  # Las columnas indican lo que predijo Random Forest.
print("\nMatriz de confusión")  # Muestra el título de la tabla.
print(confusion)  # Los valores de la diagonal son aciertos y los demás son errores.

print("\nReporte de clasificación")  # Muestra el título del reporte.
print(classification_report(y_test, y_pred, target_names=clases))  # Muestra precisión, sensibilidad y F1 para cada clase.




# 6. Graficar la matriz de confusión
plt.figure(figsize=(6, 5))  # Crea una figura de 6 pulgadas de ancho y 5 de alto.
plt.imshow(cm, interpolation="nearest", cmap="Blues")  # Colorea cada celda según su número de casos.
plt.title("Matriz de confusión - Apendicitis")  # Escribe el título de la gráfica.
plt.colorbar(label="Número de casos")  # Muestra cuántos casos representa cada tono de azul.

plt.xticks([0, 1], clases)  # Nombra las dos columnas con los diagnósticos predichos.
plt.yticks([0, 1], clases)  # Nombra las dos filas con los diagnósticos reales.
plt.xlabel("Clase predicha")  # Identifica el eje horizontal.
plt.ylabel("Clase real")  # Identifica el eje vertical.

for i in range(cm.shape[0]):  # Recorre las filas de la matriz.
    for j in range(cm.shape[1]):  # Recorre las columnas de la fila actual.
        casos = cm[i, j]  # Obtiene la cantidad de casos de esa celda.
        color = "white" if casos > cm.max() / 2 else "black"  # Usa texto claro en las celdas oscuras.
        plt.text(j, i, casos, ha="center", va="center", color=color)  # Centra el número en la celda.

plt.tight_layout()  # Ajusta los márgenes para que se lean las etiquetas.
plt.show()  # Muestra la gráfica al ejecutar el script.
