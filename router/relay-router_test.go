package router

import (
	"net/http"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"unsafe"

	"github.com/gin-gonic/gin"
)

func getUnexportedFieldValue(field reflect.Value) reflect.Value {
	if field.CanInterface() {
		return field
	}
	if !field.CanAddr() {
		return reflect.Value{}
	}
	return reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem()
}

func findHandlersByRoute(engine *gin.Engine, method, fullPath string) ([]string, bool) {
	engineValue := reflect.ValueOf(engine).Elem()
	treesValue := getUnexportedFieldValue(engineValue.FieldByName("trees"))
	if !treesValue.IsValid() {
		return nil, false
	}

	for i := 0; i < treesValue.Len(); i++ {
		methodTree := treesValue.Index(i)
		methodValue := getUnexportedFieldValue(methodTree.FieldByName("method"))
		if !methodValue.IsValid() {
			continue
		}
		if methodValue.String() != method {
			continue
		}
		rootValue := getUnexportedFieldValue(methodTree.FieldByName("root"))
		if !rootValue.IsValid() {
			continue
		}
		if names, ok := walkRouteNode(rootValue, fullPath); ok {
			return names, true
		}
	}
	return nil, false
}

func walkRouteNode(nodeValue reflect.Value, targetPath string) ([]string, bool) {
	if !nodeValue.IsValid() {
		return nil, false
	}
	if nodeValue.Kind() == reflect.Pointer {
		if nodeValue.IsNil() {
			return nil, false
		}
		nodeValue = nodeValue.Elem()
	}

	fullPathField := nodeValue.FieldByName("fullPath")
	if fullPathField.IsValid() {
		fullPathValueField := getUnexportedFieldValue(fullPathField)
		if !fullPathValueField.IsValid() {
			return nil, false
		}
		fullPathValue := fullPathValueField.String()
		if fullPathValue == targetPath {
			handlersField := getUnexportedFieldValue(nodeValue.FieldByName("handlers"))
			if !handlersField.IsValid() {
				return nil, false
			}
			handlerChain := handlersField.Interface().(gin.HandlersChain)
			if len(handlerChain) > 0 {
				names := make([]string, 0, len(handlerChain))
				for _, handler := range handlerChain {
					handlerName := runtime.FuncForPC(reflect.ValueOf(handler).Pointer()).Name()
					names = append(names, handlerName)
				}
				return names, true
			}
		}
	}

	childrenField := getUnexportedFieldValue(nodeValue.FieldByName("children"))
	if !childrenField.IsValid() {
		return nil, false
	}
	for i := 0; i < childrenField.Len(); i++ {
		if names, ok := walkRouteNode(childrenField.Index(i), targetPath); ok {
			return names, true
		}
	}
	return nil, false
}

func assertContainsMiddleware(t *testing.T, handlers []string, middlewareName string) {
	t.Helper()
	for _, handler := range handlers {
		if strings.Contains(handler, middlewareName) {
			return
		}
	}
	t.Fatalf("handler chain does not contain %s, chain=%v", middlewareName, handlers)
}

func TestRelayRouterSunoUsesUserConcurrencyLimit(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	SetRelayRouter(engine)

	handlers, ok := findHandlersByRoute(engine, http.MethodPost, "/suno/submit/:action")
	if !ok {
		t.Fatalf("route /suno/submit/:action not found")
	}
	assertContainsMiddleware(t, handlers, "UserConcurrencyLimit")
}

func TestRegisterMjRouterGroupUsesUserConcurrencyLimit(t *testing.T) {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	SetRelayRouter(engine)

	mjSubmitHandlers, ok := findHandlersByRoute(engine, http.MethodPost, "/mj/submit/imagine")
	if !ok {
		t.Fatalf("route /mj/submit/imagine not found")
	}
	assertContainsMiddleware(t, mjSubmitHandlers, "UserConcurrencyLimit")

	mjModeSubmitHandlers, ok := findHandlersByRoute(engine, http.MethodPost, "/:mode/mj/submit/imagine")
	if !ok {
		t.Fatalf("route /:mode/mj/submit/imagine not found")
	}
	assertContainsMiddleware(t, mjModeSubmitHandlers, "UserConcurrencyLimit")

	mjImageHandlers, ok := findHandlersByRoute(engine, http.MethodGet, "/mj/image/:id")
	if !ok {
		t.Fatalf("route /mj/image/:id not found")
	}
	assertContainsMiddleware(t, mjImageHandlers, "UserConcurrencyLimit")
}
