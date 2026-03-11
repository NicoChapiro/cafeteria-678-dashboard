export type ContextualNavParams = {
  branch?: string;
  asOf?: string;
  returnTo?: string;
  focus?: string;
};

export function buildEditorHref(pathname: string, params: ContextualNavParams): string {
  const query = new URLSearchParams();

  if (params.branch) query.set('branch', params.branch);
  if (params.asOf) query.set('asOf', params.asOf);
  if (params.returnTo) query.set('returnTo', params.returnTo);
  if (params.focus) query.set('focus', params.focus);

  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
