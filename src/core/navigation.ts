/** Matches paths and the query keys required by a menu item. */
export function matchesNavigation(href:string,pathname:string,search:string):boolean {
 const [path,query]=href.split('?');
 if(pathname!==path&&!pathname.startsWith(path+'/'))return false;
 const current=new URLSearchParams(search);
 return [...new URLSearchParams(query??'')].every(([key,value])=>current.get(key)===value);
}
