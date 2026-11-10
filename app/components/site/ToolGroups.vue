<script setup lang="ts">
// Every file tool in its group, as links to its page: the home page's directory and the tools page.
const { groups, toolName, toolLine, toolPage } = useSite()
</script>
<template>
  <div class="site-toolgroups">
    <div v-for="group in groups" :key="group.key" class="site-toolgroup">
      <h3>{{ group.title }}</h3>
      <ul>
        <li v-for="item in group.tools" :key="item.slug">
          <NuxtLink class="site-toollink" :to="toolPage(item.slug)"
            ><span class="site-tool-ico"><AppIcon :name="item.icon" class="site-icon" /></span
            ><span
              ><b>{{ toolName(item) }}</b><span>{{ toolLine(item) }}</span></span
            ><AppIcon name="chevron" class="site-icon is-sm"
          /></NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
