name=room3d
ip=$1
port=$2
cp -r room3d ${name}
tar -czf ${name}.tar ${name}
scp ${name}.tar root@${ip}:/usr/share/nginx/html/${name}.tar
ssh root@${ip} "cd /usr/share/nginx/html  && tar -xzf ${name}.tar && rm -rf ${name}.tar && exit"
if [ $? -eq 0 ]; then
  rm -rf ${name}.tar
  rm -rf ${name}
  rm -rf dist
  if [ -z "$port" ]; then
      echo "done. 👉 http://${ip}/${name}"
  fi
  if [ -n "$port" ]; then
      echo "done. 👉 http://${ip}:${port}/${name}"
  fi
fi

