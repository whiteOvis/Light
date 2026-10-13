// Run offscreen: never reads or changes the user's real clipboard.
#include <QGuiApplication>
#include <QClipboard>
#include <QMimeData>
#include <QQmlComponent>
#include <QQmlEngine>
#include <QDebug>
#include <QKeyEvent>
#include <memory>
#include <cstdio>

class ClipboardText final : public QMimeData {
public:
    mutable int reads = 0;
    QStringList formats() const override { return {QStringLiteral("text/plain")}; }
protected:
    QVariant retrieveData(const QString &, QMetaType) const override {
        ++reads;
        return QString(200, QLatin1Char('x'));
    }
};

int main(int argc, char **argv) {
    QGuiApplication app(argc, argv);
    QQmlEngine engine;
    QQmlComponent component(&engine);
    component.setData("import QtQuick\nTextInput { maximumLength: 100 }", QUrl());
    std::unique_ptr<QObject> input(component.create());
    if (!input) { qCritical() << component.errors(); return 2; }
    auto *text = new ClipboardText;
    QGuiApplication::clipboard()->setMimeData(text);
    QCoreApplication::processEvents();
    // A fresh input exercises the lazy getter independently of dataChanged.
    std::unique_ptr<QObject> lazyInput(component.create());
    if (!lazyInput || !lazyInput->property("canPaste").toBool()) return 7;
    if (!input->property("canPaste").toBool()) return 3;
    if (text->reads != 0) {
        std::fprintf(stderr, "FAIL: clipboard change fetched text without paste: %d reads\n", text->reads);
        return 1;
    }
    if (!input->property("text").toString().isEmpty()) return 4;
    if (!QMetaObject::invokeMethod(input.get(), "paste")) return 5;
    if (text->reads == 0 || input->property("text").toString().size() != 100) return 6;
    input->setProperty("text", "");
    QKeyEvent key(QEvent::KeyPress, Qt::Key_J, Qt::NoModifier, QStringLiteral("J"));
    QCoreApplication::sendEvent(input.get(), &key);
    if (input->property("text").toString() != QStringLiteral("J")) return 8;
    input->setProperty("text", "");
    QKeyEvent paste(QEvent::KeyPress, Qt::Key_V, Qt::ControlModifier);
    QCoreApplication::sendEvent(input.get(), &paste);
    if (input->property("text").toString().size() != 100) return 9;
    std::fprintf(stderr, "PASS: no automatic text read; typing and explicit paste retain the 100-character limit\n");
}
