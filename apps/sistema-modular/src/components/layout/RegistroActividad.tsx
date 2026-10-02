import { useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabsContext';
import { useNavigation, type NavItem } from './navigation';
import { actividadStore } from '../../services/actividadStore';
import { pantallaDeRuta } from '../../utils/actividadUsuario';

const pathsDelMenu = (items: NavItem[]): string[] =>
  items.flatMap(n => [...(n.path.startsWith('#') ? [] : [n.path]), ...pathsDelMenu(n.children ?? [])]);

/**
 * Cuenta las visitas a cada pantalla del menú para "Tus más usadas" de la
 * pestaña nueva (2026-10-01). Cada ruta nueva de la pestaña activa suma una
 * visita a la pantalla del menú a la que pertenece. No dibuja nada.
 */
export function RegistroActividad() {
  const { usuario } = useAuth();
  const { activeTabPath } = useTabs();
  const nav = useNavigation();
  const pantallas = useMemo(() => pathsDelMenu(nav), [nav]);

  useEffect(() => {
    actividadStore.iniciar(usuario?.id ?? null, usuario?.preferencias?.actividad);
  }, [usuario?.id, usuario?.preferencias?.actividad]);

  const pathname = activeTabPath.split('?')[0];
  const pantalla = pantallaDeRuta(pathname, pantallas);
  useEffect(() => {
    if (pantalla && pantalla !== '/nueva-pestana') actividadStore.registrarPantalla(pantalla);
  }, [pathname, pantalla]);

  return null;
}
